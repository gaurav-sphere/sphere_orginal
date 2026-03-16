import React, {
  useState, useRef, useMemo, useEffect, useCallback,
} from "react";
import { useNavigate } from "react-router";
import {
  MessageCircle, MoreVertical, Bookmark,
  Link2, Share2, X, Shield, UserPlus, Check,
  ChevronLeft, ChevronRight, Play, Volume2, VolumeX,
  Maximize2, Pause, Pin, Trash2, Flag, Ban,
  RefreshCw, ThumbsUp,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import {
  togglePraise,
  toggleForward,
  toggleBookmark,
  deletePost,
  blockUser,
} from "../services/feedService";

/* ══════════════════════════════════════════════════════════════
   PostCard — single source of truth for all quote cards
   
   Data contract (from feedService LivePost):
     post.id            — uuid
     post.content       — text (mapped from body)
     post.timestamp     — pre-formatted string e.g. "2h ago"
     post.likes         — number (mapped from likes_count)
     post.reposts       — number (mapped from forwards_count)
     post.thoughts      — number (mapped from thoughts_count)
     post.isLiked       — boolean
     post.isReposted    — boolean
     post.is_anon       — boolean
     post.user.id       — uuid
     post.user.name     — string
     post.user.username — string with @ prefix
     post.user.avatar   — url string
     post.user.isVerified — boolean
     post.user.is_org   — boolean
     post.mediaItems    — [{type,url,width?,height?}]
     post.comments_off  — boolean
     post.is_pinned     — boolean
     post.is_forward    — boolean
     post.originalPost  — LivePost | null (for requotes)
   
   Props:
     isLoggedIn — guest shows restricted menu + redirects to /login
     isOwn      — shows own-post menu (delete/pin) vs other-post menu
     onDelete   — called after delete/block so parent removes from list
══════════════════════════════════════════════════════════════ */

export interface PostCardProps {
  post:        any;
  isLoggedIn?: boolean;
  isOwn?:      boolean;
  onDelete?:   (id: string) => void;
}

/* ── Types ── */
interface MediaItem {
  type:    "image" | "video";
  url:     string;
  poster?: string;
  width?:  number;
  height?: number;
}

interface MenuPosition {
  left: number;
  top:  number;
}

/* ── Video mute preference in localStorage ── */
const getStoredMute = (): boolean =>
  localStorage.getItem("sphere_muted") !== "false";
const setStoredMute = (v: boolean) =>
  localStorage.setItem("sphere_muted", String(v));

/* ── Number formatter ── */
const N = (n: number): string =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M"
  : n >= 1_000   ? (n / 1_000).toFixed(1)     + "K"
  : String(n ?? 0);

/* ── Video time formatter ── */
const T = (s: number): string =>
  `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

/* ════════════════════════════════════════════════════════════
   Sub-components
════════════════════════════════════════════════════════════ */

/* Avatar with initials fallback */
function Avatar({
  src, name, size = 40, onClick,
}: {
  src?: string | null;
  name: string;
  size?: number;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const initials = (name || "U")
    .split(" ")
    .map(w => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const style: React.CSSProperties = { width: size, height: size };
  const cls = "shrink-0 rounded-full overflow-hidden";

  if (src && !imgErr) {
    return onClick ? (
      <button onClick={onClick} className={cls} style={style}>
        <img src={src} alt={name} className="w-full h-full object-cover"
          onError={() => setImgErr(true)} />
      </button>
    ) : (
      <div className={cls} style={style}>
        <img src={src} alt={name} className="w-full h-full object-cover"
          onError={() => setImgErr(true)} />
      </div>
    );
  }

  const inner = (
    <div
      className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-bold select-none"
      style={{ fontSize: size * 0.36 }}
    >{initials}</div>
  );

  return onClick ? (
    <button onClick={onClick} className={cls} style={style}>{inner}</button>
  ) : (
    <div className={cls} style={style}>{inner}</div>
  );
}

/* Video overlay button */
function VCtrl({
  onClick, children,
}: {
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-9 h-9 rounded-full bg-black/55 flex items-center justify-center text-white hover:bg-blue-600 transition-colors active:scale-95"
    >
      {children}
    </button>
  );
}

/* Menu row */
function MRow({
  icon, label, onClick, danger, muted,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-left transition-colors",
        danger ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/60"
        : muted ? "text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
        :         "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800",
      ].join(" ")}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* ════════════════════════════════════════════════════════════
   Main PostCard component
════════════════════════════════════════════════════════════ */
export function PostCard({
  post, isLoggedIn = false, isOwn = false, onDelete,
}: PostCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.id;

  /* ── Canonical URL ── */
  const quoteUrl = `/quote/${post.id}`;

  /* ── Pop-out (delete / block) ── */
  const [popping, setPopping] = useState(false);
  const [removed, setRemoved] = useState(false);

  const startPopOut = useCallback((afterCb?: () => void) => {
    setPopping(true);
    setTimeout(() => {
      setRemoved(true);
      afterCb?.();
    }, 360);
  }, []);

  /* ── Interaction state — initialised from post prop ── */
  const [liked,       setLiked]       = useState<boolean>(post.isLiked   ?? false);
  const [forwarded,   setForwarded]   = useState<boolean>(post.isReposted ?? false);
  const [bookmarked,  setBookmarked]  = useState<boolean>(false);
  const [following,   setFollowing]   = useState<boolean>(false);
  const [likeCount,   setLikeCount]   = useState<number>(post.likes   ?? 0);
  const [fwdCount,    setFwdCount]    = useState<number>(post.reposts ?? 0);
  const [followAnim,  setFollowAnim]  = useState(false);

  /* ── Load DB state once on mount ── */
  useEffect(() => {
    if (!uid || !post.id) return;
    let cancelled = false;

    /* Check bookmark */
    supabase.from("bookmarks")
      .select("user_id").eq("user_id", uid).eq("post_id", post.id)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled && data) setBookmarked(true); });

    /* Check follow */
    if (!post.is_anon && post.user?.id) {
      supabase.from("follows")
        .select("follower_id")
        .eq("follower_id", uid).eq("following_id", post.user.id)
        .maybeSingle()
        .then(({ data }) => { if (!cancelled && data) setFollowing(true); });
    }

    return () => { cancelled = true; };
  }, [uid, post.id, post.user?.id, post.is_anon]);

  /* ── Three-dot menu (fixed position) ── */
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const dotBtnRef = useRef<HTMLButtonElement>(null);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (menuPos) { setMenuPos(null); return; }
    const r = dotBtnRef.current?.getBoundingClientRect();
    if (!r) return;
    const W = 196;
    const H = isOwn ? 180 : 200;
    const left = Math.max(8, Math.min(r.right - W, window.innerWidth  - W - 8));
    const top  = r.bottom + 6 + H > window.innerHeight
      ? r.top - H - 6
      : r.bottom + 6;
    setMenuPos({ left, top });
  };

  const closeMenu = useCallback(() => setMenuPos(null), []);

  /* ── Media ── */
  const [mediaIdx,      setMediaIdx]      = useState(0);
  const [videoPlaying,  setVideoPlaying]  = useState(false);
  const [videoMuted,    setVideoMuted]    = useState(getStoredMute);
  const [videoCurrent,  setVideoCurrent]  = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [swipeSX,       setSwipeSX]       = useState(0);
  const [lazyAR,        setLazyAR]        = useState<Record<number, number>>({});
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const outerRef  = useRef<HTMLDivElement>(null);
  const [cardW, setCardW] = useState(0);

  /* Measure card width accurately */
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(es => setCardW(es[0]?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Stop non-active videos */
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (v && i !== mediaIdx) { v.pause(); }
    });
    setVideoPlaying(false);
    setVideoCurrent(0);
    setVideoDuration(0);
  }, [mediaIdx]);

  /* Apply mute preference to current video */
  useEffect(() => {
    const v = videoRefs.current[mediaIdx];
    if (v) v.muted = videoMuted;
  }, [videoMuted, mediaIdx]);

  /* Unified media list */
  const allMedia: MediaItem[] = useMemo(() => {
    if (post.mediaItems?.length > 0) return post.mediaItems as MediaItem[];
    const items: MediaItem[] = [];
    if (post.images?.length > 0) {
      post.images.forEach((u: string) => items.push({ type: "image", url: u }));
    } else if (post.image) {
      items.push({ type: "image", url: post.image });
    }
    if (post.video) {
      items.push({ type: "video", url: post.video, poster: post.videoPoster });
    }
    return items;
  }, [post]);

  /* Container height — uses DB width/height if available */
  const mediaHeight = useMemo((): number => {
    const w    = cardW || 360;
    const item = allMedia[mediaIdx];
    if (!item) return 0;

    let ar: number | null = null;
    if (item.width && item.height && item.width > 0 && item.height > 0) {
      ar = item.width / item.height;
    } else if (lazyAR[mediaIdx]) {
      ar = lazyAR[mediaIdx];
    }

    if (ar !== null) {
      const h = w / ar;
      if (ar < 0.75) return Math.min(h, 500); // portrait
      if (ar > 1.8)  return Math.min(h, 280); // wide landscape
      if (ar > 1.2)  return Math.min(h, 340); // landscape
      return           Math.min(h, 420);       // near-square
    }
    return item.type === "video" ? 280 : 320;
  }, [cardW, allMedia, mediaIdx, lazyAR]);

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>, i: number) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    if (w && h && !allMedia[i]?.width) setLazyAR(p => ({ ...p, [i]: w / h }));
  };

  const onVideoMeta = (e: React.SyntheticEvent<HTMLVideoElement>, i: number) => {
    const { videoWidth: w, videoHeight: h } = e.currentTarget;
    if (w && h && !allMedia[i]?.width) setLazyAR(p => ({ ...p, [i]: w / h }));
    setVideoDuration(e.currentTarget.duration || 0);
  };

  /* Swipe handlers */
  const onTS = (e: React.TouchEvent) => setSwipeSX(e.targetTouches[0].clientX);
  const onTE = (e: React.TouchEvent) => {
    const d = swipeSX - e.changedTouches[0].clientX;
    if (Math.abs(d) < 40) return;
    if (d > 0 && mediaIdx < allMedia.length - 1) setMediaIdx(p => p + 1);
    else if (d < 0 && mediaIdx > 0)              setMediaIdx(p => p - 1);
  };

  /* Block context-menu on media (anti-download) */
  const noCtx = (e: React.SyntheticEvent) => e.preventDefault();

  /* Video controls */
  const vidTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRefs.current[mediaIdx];
    if (!v) return;
    videoPlaying ? v.pause() : v.play();
  };
  const vidToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !videoMuted;
    setVideoMuted(next);
    setStoredMute(next);
    const v = videoRefs.current[mediaIdx];
    if (v) v.muted = next;
  };
  const vidFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRefs.current[mediaIdx];
    if (!v) return;
    if (v.requestFullscreen)                   v.requestFullscreen();
    else if ((v as any).webkitEnterFullscreen) (v as any).webkitEnterFullscreen();
  };
  const vidSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const v = videoRefs.current[mediaIdx];
    if (!v) return;
    const t = Number(e.target.value);
    v.currentTime = t;
    setVideoCurrent(t);
  };

  /* ── Guard: redirect guest to login ── */
  const guard = useCallback((fn: () => void) => {
    if (!isLoggedIn) { navigate("/login"); return; }
    fn();
  }, [isLoggedIn, navigate]);

  /* ── Profile navigation ── */
  const goProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn) { navigate("/login"); return; }
    if (!post.is_anon && post.user?.id) navigate(`/user/${post.user.id}`);
  };

  /* ── Mention click ── */
  const goMention = async (e: React.MouseEvent, raw: string) => {
    e.stopPropagation();
    if (!isLoggedIn) { navigate("/login"); return; }
    const username = raw.replace(/^@/, "").toLowerCase();
    const { data } = await supabase
      .from("profiles").select("id").ilike("username", username).maybeSingle();
    if (data?.id) navigate(`/user/${data.id}`);
  };

  /* ── Praise ── */
  const doPraise = (e: React.MouseEvent) => {
    e.stopPropagation();
    guard(() => {
      // Capture current value synchronously to avoid stale closure
      const wasLiked = liked;
      setLiked(!wasLiked);
      setLikeCount(c => wasLiked ? Math.max(0, c - 1) : c + 1);
      if (!uid) return;
      togglePraise(post.id, uid, wasLiked).catch(() => {
        // Rollback on error
        setLiked(wasLiked);
        setLikeCount(c => wasLiked ? c + 1 : Math.max(0, c - 1));
      });
    });
  };

  /* ── Forward ── */
  const doForward = (e: React.MouseEvent) => {
    e.stopPropagation();
    guard(() => {
      const wasForwarded = forwarded;
      setForwarded(!wasForwarded);
      setFwdCount(c => wasForwarded ? Math.max(0, c - 1) : c + 1);
      if (!uid) return;
      toggleForward(post.id, uid, wasForwarded).catch(() => {
        setForwarded(wasForwarded);
        setFwdCount(c => wasForwarded ? c + 1 : Math.max(0, c - 1));
      });
    });
  };

  /* ── Bookmark ── */
  const doBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    guard(() => {
      const wasBookmarked = bookmarked;
      setBookmarked(!wasBookmarked);
      if (!uid) return;
      toggleBookmark(post.id, uid, wasBookmarked).catch(() => {
        setBookmarked(wasBookmarked);
      });
    });
  };

  /* ── Follow ── */
  const doFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn) { navigate("/login"); return; }
    if (!uid || !post.user?.id) return;
    const wasFollowing = following;
    setFollowing(!wasFollowing);
    if (!wasFollowing) {
      setFollowAnim(true);
      setTimeout(() => setFollowAnim(false), 1800);
      const { error } = await supabase.from("follows")
        .insert({ follower_id: uid, following_id: post.user.id });
      if (error) setFollowing(false);
    } else {
      await supabase.from("follows").delete()
        .eq("follower_id", uid).eq("following_id", post.user.id);
    }
  };

  /* ── Delete ── */
  const doDelete = () => {
    closeMenu();
    if (!uid) return;
    // Optimistic pop-out immediately, fire DB in background
    startPopOut(() => { if (onDelete) onDelete(post.id); else navigate(-1); });
    deletePost(post.id, uid).catch(err => console.error("[PostCard] delete:", err));
  };

  /* ── Block ── */
  const doBlock = () => {
    closeMenu();
    if (!uid || !post.user?.id) return;
    startPopOut(() => { if (onDelete) onDelete(post.id); });
    blockUser(uid, post.user.id).catch(err => console.error("[PostCard] block:", err));
  };

  /* ── Requote ── */
  const doRequote = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeMenu();
    guard(() => navigate(`/create-post?requote=${post.id}`));
  };

  /* ── Pin ── */
  const doPin = async () => {
    closeMenu();
    if (!uid) return;
    await supabase.from("posts")
      .update({ is_pinned: !post.is_pinned })
      .eq("id", post.id).eq("user_id", uid);
  };

  /* ── Share / copy ── */
  const doShare = () => {
    closeMenu();
    const url = `${window.location.origin}/quote/${post.id}`;
    navigator.share?.({ url }).catch(() => {});
  };
  const doCopy = () => {
    closeMenu();
    navigator.clipboard?.writeText(`${window.location.origin}/quote/${post.id}`).catch(() => {});
  };
  const doReport = () => {
    closeMenu();
    navigate(`/report/${post.id}`);
  };

  /* ── Navigate to quote page (used by text + comment icon) ── */
  const goQuote = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(quoteUrl);
  };

  const name     = post.is_anon ? "Anonymous" : (post.user?.name     || "User");
  const uname    = post.is_anon ? ""           : (post.user?.username || "");
  const timeStr  = post.timestamp || "";   // ← uses pre-formatted feedService value

  /* ── Removed after pop-out ── */
  if (removed) return null;

  /* ── Pop-out animation CSS ── */
  const popStyle: React.CSSProperties = popping ? {
    animation: "spherePopOut 360ms cubic-bezier(.4,0,.6,1) forwards",
    overflow:  "hidden",
    pointerEvents: "none",
  } : {};

  return (
    <>
      {/* Keyframes injected inline once */}
      <style>{`
        @keyframes spherePopOut {
          0%   { opacity:1; transform:scale(1); max-height:600px }
          35%  { opacity:.7; transform:scale(1.02) }
          100% { opacity:0; transform:scale(.86); max-height:0; padding-top:0; padding-bottom:0; border:none }
        }
        @keyframes followBadge {
          0%   { opacity:0; transform:translateY(6px) scale(.8) }
          20%  { opacity:1; transform:translateY(0) scale(1.05) }
          65%  { opacity:1 }
          100% { opacity:0; transform:translateY(-10px) scale(.9) }
        }
      `}</style>

      <div
        className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 relative"
        style={popStyle}
      >
        {/* Following badge */}
        {followAnim && (
          <div
            className="absolute top-3 right-12 z-20 flex items-center gap-1 bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg pointer-events-none"
            style={{ animation: "followBadge 1.8s ease-out forwards" }}
          >
            <Check size={11} /> Following!
          </div>
        )}

        {/* ── Main row ── */}
        <div className="flex gap-3 px-4 pt-3 pb-2.5">

          {/* Avatar — stops propagation, does NOT open quote page */}
          <div className="shrink-0 pt-0.5">
            {post.is_anon ? (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center">
                <Shield size={18} className="text-white" />
              </div>
            ) : (
              <Avatar
                src={post.user?.avatar}
                name={name}
                size={40}
                onClick={goProfile}
              />
            )}
          </div>

          {/* Right column */}
          <div className="flex-1 min-w-0">

            {/* Header: name + controls */}
            <div className="flex items-start justify-between gap-1 mb-1.5">

              {/* Name block — clickable → profile */}
              <button onClick={goProfile} className="text-left min-w-0 flex-1">
                <div className="flex items-center gap-1 flex-wrap leading-tight">
                  <span className="font-bold text-gray-900 dark:text-white text-sm hover:underline">
                    {name}
                  </span>
                  {/* Verified badge — from DB is_verified */}
                  {post.user?.isVerified && !post.is_anon && (
                    <span className="inline-flex items-center justify-center w-[15px] h-[15px] bg-blue-500 rounded-full shrink-0">
                      <Check size={9} className="text-white" strokeWidth={3} />
                    </span>
                  )}
                  {/* Org badge */}
                  {post.user?.is_org && !post.is_anon && (
                    <span className="inline-flex items-center justify-center w-[15px] h-[15px] bg-purple-500 rounded-full shrink-0">
                      <Check size={9} className="text-white" strokeWidth={3} />
                    </span>
                  )}
                </div>
                {/* Username + timestamp on second line */}
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">
                  {post.is_anon
                    ? timeStr
                    : `${uname} · ${timeStr}`
                  }
                </div>
              </button>

              {/* Follow button (other's post, logged-in only) + three-dot */}
              <div className="flex items-center gap-1 shrink-0">
                {!isOwn && !post.is_anon && isLoggedIn && (
                  <button
                    onClick={doFollow}
                    className={[
                      "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-colors",
                      following
                        ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950"
                        : "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950",
                    ].join(" ")}
                  >
                    {following ? <Check size={11} /> : <UserPlus size={11} />}
                    <span>{following ? "Following" : "Follow"}</span>
                  </button>
                )}

                {/* THREE VERTICAL DOTS — MoreVertical icon */}
                <button
                  ref={dotBtnRef}
                  onClick={openMenu}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <MoreVertical size={16} />
                </button>
              </div>
            </div>

            {/* ── Quote text — clicking opens quote page ── */}
            {post.content ? (
              <p
                onClick={goQuote}
                className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed break-words cursor-pointer"
              >
                {post.content.split(/(\s+)/).map((token: string, i: number) => {
                  const t = token.trim();
                  if (t.startsWith("#") && t.length > 1) {
                    return (
                      <span key={i}
                        onClick={e => {
                          e.stopPropagation();
                          navigate(
                            isLoggedIn
                              ? `/feed/search?q=${encodeURIComponent(t)}`
                              : `/search?q=${encodeURIComponent(t)}`
                          );
                        }}
                        className="text-blue-500 hover:underline cursor-pointer"
                      >{token}</span>
                    );
                  }
                  if (t.startsWith("@") && t.length > 1) {
                    return (
                      <span key={i}
                        onClick={e => goMention(e, t)}
                        className="text-blue-500 hover:underline cursor-pointer font-medium"
                      >{token}</span>
                    );
                  }
                  return token;
                })}
              </p>
            ) : null}

            {/* ── Requote embed ── */}
            {post.is_forward && post.originalPost && (
              <div
                onClick={e => { e.stopPropagation(); navigate(`/quote/${post.originalPost.id}`); }}
                className="mt-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
              >
                {post.forward_comment && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 italic">
                    "{post.forward_comment}"
                  </p>
                )}
                <div className="flex items-center gap-2 mb-1">
                  <Avatar
                    src={post.originalPost.user?.avatar}
                    name={post.originalPost.user?.name || "User"}
                    size={18}
                  />
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    {post.originalPost.user?.name}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {post.originalPost.user?.username}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3">
                  {post.originalPost.content}
                </p>
              </div>
            )}

            {/* ── Media slider ── */}
            {allMedia.length > 0 && (
              <div
                ref={outerRef}
                className="mt-2 rounded-2xl overflow-hidden relative select-none bg-black"
                style={{
                  height: mediaHeight > 0 ? `${mediaHeight}px` : undefined,
                  minHeight: "120px",
                }}
                onTouchStart={onTS}
                onTouchEnd={onTE}
              >
                {allMedia.map((item, i) => (
                  <div
                    key={i}
                    className="absolute inset-0 w-full h-full"
                    style={{
                      transform:  `translateX(${(i - mediaIdx) * 100}%)`,
                      transition: "transform .28s cubic-bezier(.4,0,.2,1)",
                      willChange: "transform",
                    }}
                  >
                    {item.type === "image" ? (
                      /* IMAGE — tap opens MediaPage */
                      <div
                        className="relative w-full h-full overflow-hidden cursor-pointer"
                        onClick={e => { e.stopPropagation(); navigate(`/media/${post.id}/${i}`); }}
                        onContextMenu={noCtx}
                      >
                        {/* Blurred cinematic background */}
                        <img
                          src={item.url} aria-hidden draggable={false}
                          className="absolute inset-0 w-full h-full object-cover scale-110 pointer-events-none"
                          style={{ filter: "blur(18px) brightness(.4) saturate(1.6)" }}
                          onContextMenu={noCtx}
                        />
                        {/* Main image contained */}
                        <img
                          src={item.url} alt="quote media" draggable={false}
                          className="relative z-10 w-full h-full object-contain"
                          onLoad={e => onImgLoad(e, i)}
                          onContextMenu={noCtx}
                        />
                      </div>
                    ) : (
                      /* VIDEO */
                      <div
                        className="relative w-full h-full overflow-hidden bg-black"
                        onContextMenu={noCtx}
                      >
                        {/* Blurred poster background */}
                        {item.poster && (
                          <img
                            src={item.poster} aria-hidden draggable={false}
                            className="absolute inset-0 w-full h-full object-cover scale-110"
                            style={{ filter: "blur(18px) brightness(.3) saturate(1.6)" }}
                            onContextMenu={noCtx}
                          />
                        )}

                        <video
                          ref={el => {
                            videoRefs.current[i] = el;
                            if (el) {
                              (el as any).disableRemotePlayback = true;
                              el.muted = videoMuted;
                            }
                          }}
                          src={item.url}
                          poster={item.poster}
                          muted={videoMuted}
                          loop
                          playsInline
                          className="relative z-10 w-full h-full object-contain"
                          onLoadedMetadata={e => onVideoMeta(e, i)}
                          onPlay={() => i === mediaIdx && setVideoPlaying(true)}
                          onPause={() => i === mediaIdx && setVideoPlaying(false)}
                          onTimeUpdate={e => {
                            if (i === mediaIdx) setVideoCurrent(e.currentTarget.currentTime);
                          }}
                          onContextMenu={noCtx}
                        />

                        {/* Video controls — only for active slide */}
                        {i === mediaIdx && (
                          <div className="absolute inset-0 z-20 flex flex-col justify-between p-2.5 pointer-events-none">
                            {/* Top row */}
                            <div className="flex items-center justify-between pointer-events-auto">
                              {/* Play / Pause — LEFT */}
                              <VCtrl onClick={vidTogglePlay}>
                                {videoPlaying
                                  ? <Pause size={14} fill="white" />
                                  : <Play  size={14} fill="white" className="ml-0.5" />}
                              </VCtrl>

                              {/* Volume + Fullscreen — RIGHT */}
                              <div className="flex items-center gap-1.5">
                                {/* Volume button + vertical bar */}
                                <div className="flex items-center gap-1 bg-black/45 rounded-full px-2 py-1">
                                  <VCtrl onClick={vidToggleMute}>
                                    {videoMuted
                                      ? <VolumeX size={13} />
                                      : <Volume2 size={13} />}
                                  </VCtrl>
                                  {/* Vertical level bar */}
                                  <div className="w-1 h-8 bg-white/20 rounded-full overflow-hidden flex flex-col-reverse">
                                    <div
                                      className="w-full bg-white rounded-full transition-all duration-150"
                                      style={{ height: videoMuted ? "0%" : "100%" }}
                                    />
                                  </div>
                                </div>
                                <VCtrl onClick={vidFullscreen}>
                                  <Maximize2 size={13} />
                                </VCtrl>
                              </div>
                            </div>

                            {/* Big play overlay when paused */}
                            {!videoPlaying && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-14 h-14 rounded-full bg-black/40 flex items-center justify-center">
                                  <Play size={26} fill="white" className="text-white ml-1" />
                                </div>
                              </div>
                            )}

                            {/* Seek bar + timestamps — BOTTOM */}
                            <div className="flex items-center gap-2 pointer-events-auto">
                              <span className="text-white text-[10px] font-mono shrink-0">
                                {T(videoCurrent)}
                              </span>
                              <input
                                type="range"
                                min={0}
                                max={videoDuration || 100}
                                value={videoCurrent}
                                onChange={vidSeek}
                                onClick={e => e.stopPropagation()}
                                className="flex-1 h-1 appearance-none rounded-full cursor-pointer"
                                style={{
                                  background: `linear-gradient(to right, white ${(videoCurrent / (videoDuration || 1)) * 100}%, rgba(255,255,255,.25) 0%)`,
                                }}
                              />
                              <span className="text-white text-[10px] font-mono shrink-0">
                                {T(videoDuration)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Prev / Next arrows */}
                {allMedia.length > 1 && mediaIdx > 0 && (
                  <button
                    onClick={e => { e.stopPropagation(); setMediaIdx(p => p - 1); }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-blue-600 z-30 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                )}
                {allMedia.length > 1 && mediaIdx < allMedia.length - 1 && (
                  <button
                    onClick={e => { e.stopPropagation(); setMediaIdx(p => p + 1); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-blue-600 z-30 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                )}

                {/* Dot indicators */}
                {allMedia.length > 1 && (
                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-1.5 z-30">
                    {allMedia.map((_, i) => (
                      <button
                        key={i}
                        onClick={e => { e.stopPropagation(); setMediaIdx(i); }}
                        className={`rounded-full transition-all ${
                          i === mediaIdx ? "bg-white w-4 h-1.5" : "bg-white/50 w-1.5 h-1.5"
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* Counter badge */}
                {allMedia.length > 1 && (
                  <div className="absolute top-2 right-2 z-30">
                    <span className="bg-black/40 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      {mediaIdx + 1}/{allMedia.length}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── Action bar ── */}
            {!post.comments_off && (
              <div className="flex items-center gap-4 mt-2.5">

                {/* Thoughts — opens quote page */}
                <button
                  onClick={goQuote}
                  className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                >
                  <MessageCircle size={16} />
                  <span className="text-xs font-medium">{N(post.thoughts ?? 0)}</span>
                </button>

                {/* Forward */}
                <button
                  onClick={doForward}
                  className={`flex items-center gap-1.5 transition-colors ${
                    forwarded
                      ? "text-green-500"
                      : "text-gray-400 dark:text-gray-500 hover:text-green-500"
                  }`}
                >
                  <RefreshCw size={16} />
                  <span className="text-xs font-medium">{N(fwdCount)}</span>
                </button>

                {/* Praise */}
                <button
                  onClick={doPraise}
                  className={`flex items-center gap-1.5 transition-colors ${
                    liked
                      ? "text-orange-500"
                      : "text-gray-400 dark:text-gray-500 hover:text-orange-500"
                  }`}
                >
                  <ThumbsUp size={16} className={liked ? "fill-orange-500" : ""} />
                  <span className="text-xs font-medium">{N(likeCount)}</span>
                </button>

                <div className="flex-1" />

                {/* Bookmark — logged-in only, shows filled blue when saved */}
                {isLoggedIn && (
                  <button
                    onClick={doBookmark}
                    className={`transition-colors ${
                      bookmarked
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-400 dark:text-gray-500 hover:text-blue-500"
                    }`}
                  >
                    <Bookmark
                      size={16}
                      className={bookmarked ? "fill-blue-600 dark:fill-blue-400" : ""}
                    />
                  </button>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          THREE-DOT MENU — position:fixed
          z-[9998] backdrop catches every outside tap
          z-[9999] menu sits on top
      ════════════════════════════════════════════ */}
      {menuPos && (
        <>
          {/* Backdrop — covers entire screen, closes menu on any tap */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={closeMenu}
            onTouchStart={e => { e.preventDefault(); closeMenu(); }}
          />

          <div
            className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden py-1"
            style={{ left: menuPos.left, top: menuPos.top, width: 196 }}
            onClick={e => e.stopPropagation()}
          >
            {isOwn ? (
              /* ── OWN QUOTE ── */
              <>
                <MRow icon={<RefreshCw size={14} />} label="Requote"    onClick={doRequote} />
                <MRow icon={<Pin size={14} />} label={post.is_pinned ? "Unpin" : "Pin"} onClick={doPin} />
                <MRow icon={<Share2 size={14} />}     label="Share"     onClick={doShare} />
                <div className="h-px bg-gray-100 dark:bg-gray-700 mx-3 my-1" />
                <MRow icon={<Trash2 size={14} />}     label="Delete"    onClick={doDelete} danger />
                <div className="h-px bg-gray-100 dark:bg-gray-700 mx-3 my-1" />
                <MRow icon={<X size={14} />}           label="Cancel"   onClick={closeMenu} muted />
              </>
            ) : isLoggedIn ? (
              /* ── OTHER'S QUOTE (logged in) ── */
              <>
                <MRow icon={<RefreshCw size={14} />}  label="Requote"              onClick={doRequote} />
                <MRow icon={<Ban size={14} />}         label={`Block ${uname}`}    onClick={doBlock}  danger />
                <MRow icon={<Share2 size={14} />}      label="Share"               onClick={doShare} />
                <MRow icon={<Flag size={14} />}        label="Report"              onClick={doReport} danger />
                <div className="h-px bg-gray-100 dark:bg-gray-700 mx-3 my-1" />
                <MRow icon={<X size={14} />}           label="Cancel"              onClick={closeMenu} muted />
              </>
            ) : (
              /* ── GUEST ── */
              <>
                <MRow icon={<Share2 size={14} />}  label="Share"      onClick={doShare} />
                <MRow icon={<Link2 size={14} />}   label="Copy link"  onClick={doCopy} />
                <div className="h-px bg-gray-100 dark:bg-gray-700 mx-3 my-1" />
                <MRow icon={<X size={14} />}       label="Cancel"     onClick={closeMenu} muted />
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

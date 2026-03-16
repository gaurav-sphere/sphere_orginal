import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
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
  togglePraise, toggleForward, toggleBookmark,
  deletePost, blockUser,
} from "../services/feedService";

/* ══════════════════════════════════════════════════════════════
   PostCard — definitive version
   Fixes applied:
   ✓ Canonical URL /quote/:id everywhere
   ✓ Card does NOT navigate on full click — only quote text does
   ✓ Media click → MediaPage, stops propagation properly
   ✓ Avatar/name click → profile
   ✓ Three-dot menu: MoreVertical (vertical dots)
   ✓ Menu uses position:fixed from getBoundingClientRect
   ✓ Menu closes on backdrop click (fixed inset-0 z-[9998])
   ✓ Pop-out animation on delete and block
   ✓ isLoggedIn controls which menu shows
   ✓ Dark mode on all elements
   ✓ No layout gap below avatar
══════════════════════════════════════════════════════════════ */

interface MediaItem {
  type: "image" | "video";
  url: string;
  poster?: string;
  width?: number;
  height?: number;
}

export interface PostCardProps {
  post:        any;
  isLoggedIn?: boolean;
  isOwn?:      boolean;
  onDelete?:   (id: string) => void;
}

/* ── Mute preference persisted in localStorage ── */
const getMutePref  = (): boolean => localStorage.getItem("sphere_video_muted") !== "false";
const saveMutePref = (v: boolean) => localStorage.setItem("sphere_video_muted", String(v));

/* ── Formatters ── */
const fmt = (n: number): string =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M"
  : n >= 1_000   ? (n / 1_000).toFixed(1)     + "K"
  : String(n ?? 0);

const fmtTime = (s: number): string =>
  `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

/* ── Pop-out animation ── */
const POP_CSS = `
  @keyframes spherePopOut {
    0%   { opacity:1; transform:scale(1)    max-height:500px }
    35%  { opacity:.7; transform:scale(1.03) }
    100% { opacity:0; transform:scale(.88); max-height:0; padding:0; margin:0 }
  }
  .sphere-pop-out {
    animation: spherePopOut 360ms cubic-bezier(.4,0,.6,1) forwards;
    overflow: hidden;
    pointer-events: none;
  }
`;

/* ── Avatar ── */
function Avatar({
  src, name, size = 40, onClick,
}: { src?: string | null; name: string; size?: number; onClick?: () => void }) {
  const [err, setErr] = useState(false);
  const initials = (name || "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const Tag: any = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className="shrink-0 rounded-full overflow-hidden"
      style={{ width: size, height: size }}
    >
      {src && !err ? (
        <img
          src={src} alt={name}
          className="w-full h-full object-cover"
          onError={() => setErr(true)}
        />
      ) : (
        <div
          className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-bold"
          style={{ fontSize: size * 0.36 }}
        >{initials}</div>
      )}
    </Tag>
  );
}

/* ── Video control button ── */
function VBtn({
  onClick, children,
}: { onClick: (e: React.MouseEvent) => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-blue-600 active:scale-95 transition-all"
    >{children}</button>
  );
}

/* ── Menu item ── */
function MItem({
  icon, label, onClick, danger = false, muted = false,
}: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; muted?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] transition-colors text-left ${
        danger ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
        : muted ? "text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
        : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      }`}
    >
      {icon} {label}
    </button>
  );
}

export function PostCard({
  post, isLoggedIn = false, isOwn = false, onDelete,
}: PostCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.id;

  /* ── Canonical quote URL ── */
  const quoteRoute = `/quote/${post.id}`;

  /* ── Pop-out (delete / block animation) ── */
  const [poppingOut, setPoppingOut] = useState(false);
  const [gone,       setGone]       = useState(false);

  const doPopOut = useCallback((cb?: () => void) => {
    setPoppingOut(true);
    setTimeout(() => { setGone(true); cb?.(); }, 380);
  }, []);

  /* ── Action states ── */
  const [liked,       setLiked]       = useState<boolean>(post.isLiked   ?? false);
  const [reposted,    setReposted]    = useState<boolean>(post.isReposted ?? false);
  const [likeCount,   setLikeCount]   = useState<number>(post.likes      ?? 0);
  const [repostCount, setRepostCount] = useState<number>(post.reposts    ?? 0);
  const [saved,       setSaved]       = useState(false);
  const [following,   setFollowing]   = useState(false);
  const [followAnim,  setFollowAnim]  = useState(false);

  /* ── Menu state ── uses position:fixed coords ── */
  interface MenuCoords { left: number; top: number }
  const [menu,   setMenu]   = useState<MenuCoords | null>(null);
  const dotRef = useRef<HTMLButtonElement>(null);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (menu) { setMenu(null); return; }
    const r = dotRef.current?.getBoundingClientRect();
    if (!r) return;
    const menuW = 196;
    const menuH = isOwn ? 176 : 200;
    let left = r.right - menuW;
    let top  = r.bottom + 4;
    if (left < 8)                           left = 8;
    if (top + menuH > window.innerHeight - 8) top = r.top - menuH - 4;
    setMenu({ left, top });
  };

  const closeMenu = () => setMenu(null);

  /* ── Media ── */
  const [mediaIdx,      setMediaIdx]      = useState(0);
  const [videoPlaying,  setVideoPlaying]  = useState(false);
  const [videoMuted,    setVideoMuted]    = useState(getMutePref);
  const [videoCurrent,  setVideoCurrent]  = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [touchSX,       setTouchSX]       = useState(0);
  const [lazyAR,        setLazyAR]        = useState<Record<number, number>>({});
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const outerRef  = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(0);

  useEffect(() => {
    if (!outerRef.current) return;
    const ro = new ResizeObserver(es => setCw(es[0]?.contentRect.width ?? 0));
    ro.observe(outerRef.current);
    return () => ro.disconnect();
  }, []);

  /* Load follow state */
  useEffect(() => {
    if (!uid || !post.user?.id || post.is_anon) return;
    supabase.from("follows").select("follower_id")
      .eq("follower_id", uid).eq("following_id", post.user.id).maybeSingle()
      .then(({ data }) => { if (data) setFollowing(true); });
  }, [uid, post.user?.id]);

  /* Unified media array */
  const allMedia: MediaItem[] = useMemo(() => {
    if (post.mediaItems?.length > 0) return post.mediaItems;
    const items: MediaItem[] = [];
    if (post.images?.length > 0) post.images.forEach((u: string) => items.push({ type: "image", url: u }));
    else if (post.image)          items.push({ type: "image", url: post.image });
    if (post.video)               items.push({ type: "video", url: post.video, poster: post.videoPoster });
    return items;
  }, [post]);

  /* Container height — pre-calculated from DB dimensions, fallback to lazy */
  const containerH = useMemo((): number => {
    const w    = cw || 360;
    const item = allMedia[mediaIdx];
    if (!item) return 0;
    let ar: number | null = null;
    if (item.width && item.height && item.width > 0) ar = item.width / item.height;
    else if (lazyAR[mediaIdx])                        ar = lazyAR[mediaIdx];
    if (ar !== null) {
      const n = w / ar;
      if (ar < 0.75) return Math.min(n, 520);
      if (ar > 1.8)  return Math.min(n, 280);
      if (ar > 1.2)  return Math.min(n, 340);
      return Math.min(n, 420);
    }
    return item.type === "video" ? 280 : 320;
  }, [cw, allMedia, mediaIdx, lazyAR]);

  /* Pause non-active videos */
  useEffect(() => {
    videoRefs.current.forEach((v, i) => { if (v && i !== mediaIdx) v.pause(); });
    setVideoPlaying(false); setVideoCurrent(0); setVideoDuration(0);
  }, [mediaIdx]);

  useEffect(() => {
    const v = videoRefs.current[mediaIdx];
    if (v) v.muted = videoMuted;
  }, [videoMuted, mediaIdx]);

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>, idx: number) => {
    const { naturalWidth: nw, naturalHeight: nh } = e.currentTarget;
    if (nw && nh && !allMedia[idx]?.width) setLazyAR(p => ({ ...p, [idx]: nw / nh }));
  };
  const onVideoMeta = (e: React.SyntheticEvent<HTMLVideoElement>, idx: number) => {
    const { videoWidth: vw, videoHeight: vh } = e.currentTarget;
    if (vw && vh && !allMedia[idx]?.width) setLazyAR(p => ({ ...p, [idx]: vw / vh }));
    setVideoDuration(e.currentTarget.duration || 0);
  };

  /* Swipe */
  const onTouchStart = (e: React.TouchEvent) => setTouchSX(e.targetTouches[0].clientX);
  const onTouchEnd   = (e: React.TouchEvent) => {
    const d = touchSX - e.changedTouches[0].clientX;
    if (Math.abs(d) < 40) return;
    if (d > 0 && mediaIdx < allMedia.length - 1) setMediaIdx(p => p + 1);
    else if (d < 0 && mediaIdx > 0)              setMediaIdx(p => p - 1);
  };

  /* Block context menu on media (anti-piracy) */
  const noCtx = (e: React.MouseEvent | React.TouchEvent) => e.preventDefault();

  /* Video controls */
  const doTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRefs.current[mediaIdx];
    if (v) videoPlaying ? v.pause() : v.play();
  };
  const doToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !videoMuted;
    setVideoMuted(next); saveMutePref(next);
    const v = videoRefs.current[mediaIdx];
    if (v) v.muted = next;
  };
  const doFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRefs.current[mediaIdx];
    if (!v) return;
    if (v.requestFullscreen)                     v.requestFullscreen();
    else if ((v as any).webkitEnterFullscreen)   (v as any).webkitEnterFullscreen();
  };
  const doSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const v = videoRefs.current[mediaIdx];
    if (!v) return;
    v.currentTime = Number(e.target.value);
    setVideoCurrent(Number(e.target.value));
  };

  /* Login guard */
  const withLogin = useCallback((fn?: () => void) => {
    if (!isLoggedIn) { navigate("/login"); return; }
    fn?.();
  }, [isLoggedIn, navigate]);

  /* Name / avatar */
  const goProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn) { navigate("/login"); return; }
    if (!post.is_anon && post.user?.id) navigate(`/user/${post.user.id}`);
  };

  /* @mention */
  const goMention = async (e: React.MouseEvent, raw: string) => {
    e.stopPropagation();
    if (!isLoggedIn) { navigate("/login"); return; }
    const un = raw.replace(/^@/, "").toLowerCase();
    const { data } = await supabase.from("profiles").select("id").ilike("username", un).maybeSingle();
    if (data?.id) navigate(`/user/${data.id}`);
  };

  /* Praise */
  const doPraise = (e: React.MouseEvent) => {
    e.stopPropagation();
    withLogin(() => {
      const next = !liked;
      setLiked(next);
      setLikeCount(c => next ? c + 1 : Math.max(0, c - 1));
      if (uid) togglePraise(post.id, uid, liked).catch(() => {
        setLiked(!next);
        setLikeCount(c => !next ? c + 1 : Math.max(0, c - 1));
      });
    });
  };

  /* Forward */
  const doForward = (e: React.MouseEvent) => {
    e.stopPropagation();
    withLogin(() => {
      const next = !reposted;
      setReposted(next);
      setRepostCount(c => next ? c + 1 : Math.max(0, c - 1));
      if (uid) toggleForward(post.id, uid, reposted).catch(() => {
        setReposted(!next);
        setRepostCount(c => !next ? c + 1 : Math.max(0, c - 1));
      });
    });
  };

  /* Bookmark */
  const doBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    withLogin(() => {
      const next = !saved;
      setSaved(next);
      if (uid) toggleBookmark(post.id, uid, saved).catch(() => setSaved(!next));
    });
  };

  /* Follow */
  const doFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn) { navigate("/login"); return; }
    if (!uid || !post.user?.id) return;
    if (!following) {
      setFollowing(true); setFollowAnim(true);
      setTimeout(() => setFollowAnim(false), 1800);
      const { error } = await supabase.from("follows")
        .insert({ follower_id: uid, following_id: post.user.id });
      if (error) setFollowing(false);
    } else {
      setFollowing(false);
      await supabase.from("follows").delete()
        .eq("follower_id", uid).eq("following_id", post.user.id);
    }
  };

  /* Delete — pop-out then remove */
  const doDelete = () => {
    closeMenu();
    if (!uid) return;
    doPopOut(() => { if (onDelete) onDelete(post.id); else navigate(-1); });
    deletePost(post.id, uid);
  };

  /* Block — pop-out */
  const doBlock = () => {
    closeMenu();
    if (!uid || !post.user?.id) return;
    doPopOut(() => { if (onDelete) onDelete(post.id); });
    blockUser(uid, post.user.id);
  };

  /* Requote */
  const doRequote = (e: React.MouseEvent) => {
    e.stopPropagation(); closeMenu();
    withLogin(() => navigate(`/create-post?requote=${post.id}`));
  };

  /* Pin */
  const doPin = async () => {
    closeMenu();
    if (!uid) return;
    await supabase.from("posts").update({ is_pinned: !post.is_pinned })
      .eq("id", post.id).eq("user_id", uid);
  };

  const doCopyLink = () => {
    closeMenu();
    navigator.clipboard?.writeText(`${window.location.origin}/quote/${post.id}`).catch(() => {});
  };
  const doShare = () => {
    closeMenu();
    navigator.share?.({ url: `${window.location.origin}/quote/${post.id}` }).catch(() => {});
  };
  const doReport = () => {
    closeMenu();
    navigate(`/report/${post.id}`);
  };

  /* Go to quote page — only called from text / comment icon */
  const goQuote = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(quoteRoute);
  };

  const displayName     = post.is_anon ? "Anonymous" : (post.user?.name || "User");
  const displayUsername = post.is_anon ? ""          : (post.user?.username || "");

  if (gone) return null;

  return (
    <>
      <style>{POP_CSS}</style>

      {/* ── Card wrapper — NOT clickable as a whole ── */}
      <div
        className={`bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 relative${
          poppingOut ? " sphere-pop-out" : ""
        }`}
      >
        {/* Follow badge */}
        {followAnim && (
          <div
            className="absolute top-3 right-14 z-20 flex items-center gap-1.5 bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg pointer-events-none"
            style={{ animation: "followPop 1.8s ease-out forwards" }}
          >
            <Check size={11} /> Following!
          </div>
        )}
        <style>{`@keyframes followPop{0%{opacity:0;transform:translateY(8px) scale(.8)}20%{opacity:1;transform:translateY(0) scale(1.05)}60%{opacity:1}100%{opacity:0;transform:translateY(-12px) scale(.9)}}`}</style>

        {/* ── Layout row ── */}
        <div className="flex gap-3 px-4 pt-3 pb-2">

          {/* Avatar — clickable */}
          <div className="shrink-0 pt-0.5">
            {post.is_anon ? (
              <div
                className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center cursor-default"
              >
                <Shield size={18} className="text-white" />
              </div>
            ) : (
              <Avatar
                src={post.user?.avatar}
                name={displayName}
                size={40}
                onClick={goProfile}
              />
            )}
          </div>

          {/* Content column */}
          <div className="flex-1 min-w-0">

            {/* Name row */}
            <div className="flex items-start justify-between gap-1">

              {/* Name + username — clickable */}
              <button onClick={goProfile} className="text-left min-w-0 flex-1">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="font-bold text-gray-900 dark:text-white text-sm leading-tight hover:underline">
                    {displayName}
                  </span>
                  {post.user?.isVerified && !post.is_anon && (
                    <span className="inline-flex items-center justify-center w-4 h-4 bg-blue-500 rounded-full shrink-0">
                      <Check size={9} className="text-white" strokeWidth={3} />
                    </span>
                  )}
                  {post.user?.is_org && !post.is_anon && (
                    <span className="inline-flex items-center justify-center w-4 h-4 bg-purple-500 rounded-full shrink-0">
                      <Check size={9} className="text-white" strokeWidth={3} />
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 leading-tight mt-0.5">
                  {post.is_anon ? post.timestamp : `${displayUsername} · ${post.timestamp}`}
                </div>
              </button>

              {/* Right side: follow + three-dot */}
              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                {!isOwn && !post.is_anon && isLoggedIn && (
                  <button
                    onClick={doFollow}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-colors ${
                      following
                        ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950"
                        : "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950"
                    }`}
                  >
                    {following ? <Check size={11} /> : <UserPlus size={11} />}
                    <span>{following ? "Following" : "Follow"}</span>
                  </button>
                )}

                {/* THREE VERTICAL DOTS */}
                <button
                  ref={dotRef}
                  onClick={openMenu}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <MoreVertical size={16} />
                </button>
              </div>
            </div>

            {/* ── Quote text — CLICKABLE → opens quote page ── */}
            <p
              onClick={goQuote}
              className="text-gray-800 dark:text-gray-200 text-sm mt-1.5 leading-relaxed break-words cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {(post.content || "").split(/(\s+)/).map((token: string, i: number) => {
                const c = token.trim();
                if (c.startsWith("#") && c.length > 1) return (
                  <span key={i}
                    onClick={e => { e.stopPropagation(); navigate(isLoggedIn ? `/feed/search?q=${encodeURIComponent(c)}` : `/search?q=${encodeURIComponent(c)}`); }}
                    className="text-blue-500 cursor-pointer hover:underline"
                  >{token}</span>
                );
                if (c.startsWith("@") && c.length > 1) return (
                  <span key={i}
                    onClick={e => goMention(e, c)}
                    className="text-blue-500 cursor-pointer font-medium hover:underline"
                  >{token}</span>
                );
                return token;
              })}
            </p>

            {/* ── Requote embedded card ── */}
            {post.is_forward && post.originalPost && (
              <div
                onClick={e => { e.stopPropagation(); navigate(`/quote/${post.originalPost.id}`); }}
                className="mt-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
              >
                {post.forward_comment && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 italic">"{post.forward_comment}"</p>
                )}
                <div className="flex items-center gap-2 mb-1">
                  <Avatar src={post.originalPost.user?.avatar} name={post.originalPost.user?.name || "User"} size={20} />
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{post.originalPost.user?.name}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{post.originalPost.user?.username}</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3">{post.originalPost.content}</p>
              </div>
            )}

            {/* ── MEDIA — click opens MediaPage, stops propagation ── */}
            {allMedia.length > 0 && (
              <div
                ref={outerRef}
                className="mt-2 rounded-2xl overflow-hidden relative select-none bg-black"
                style={{ height: containerH > 0 ? `${containerH}px` : undefined, minHeight: "120px" }}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
              >
                {allMedia.map((item, i) => (
                  <div key={i}
                    className="absolute inset-0 w-full h-full"
                    style={{
                      transform:  `translateX(${(i - mediaIdx) * 100}%)`,
                      transition: "transform .28s cubic-bezier(.4,0,.2,1)",
                      willChange: "transform",
                    }}
                  >
                    {item.type === "image" ? (
                      <div
                        className="relative w-full h-full overflow-hidden cursor-pointer"
                        onClick={e => { e.stopPropagation(); navigate(`/media/${post.id}/${i}`); }}
                        onContextMenu={noCtx}
                        onTouchStart={e => { e.stopPropagation(); noCtx(e); }}
                      >
                        {/* Blurred bg */}
                        <img src={item.url} aria-hidden draggable={false}
                          className="absolute inset-0 w-full h-full object-cover scale-110 pointer-events-none"
                          style={{ filter: "blur(18px) brightness(.4) saturate(1.6)" }}
                          onContextMenu={noCtx}
                        />
                        {/* Main */}
                        <img src={item.url} alt="quote media" draggable={false}
                          className="relative z-10 w-full h-full object-contain"
                          onLoad={e => onImgLoad(e, i)}
                          onContextMenu={noCtx}
                        />
                      </div>
                    ) : (
                      <div className="relative w-full h-full overflow-hidden bg-black" onContextMenu={noCtx}>
                        {item.poster && (
                          <img src={item.poster} aria-hidden draggable={false}
                            className="absolute inset-0 w-full h-full object-cover scale-110"
                            style={{ filter: "blur(18px) brightness(.3) saturate(1.6)" }}
                            onContextMenu={noCtx}
                          />
                        )}
                        <video
                          ref={el => {
                            videoRefs.current[i] = el;
                            if (el) { (el as any).disableRemotePlayback = true; el.muted = videoMuted; }
                          }}
                          src={item.url} poster={item.poster}
                          muted={videoMuted} loop playsInline
                          className="relative z-10 w-full h-full object-contain"
                          onLoadedMetadata={e => onVideoMeta(e, i)}
                          onPlay={() => i === mediaIdx && setVideoPlaying(true)}
                          onPause={() => i === mediaIdx && setVideoPlaying(false)}
                          onTimeUpdate={e => i === mediaIdx && setVideoCurrent(e.currentTarget.currentTime)}
                          onContextMenu={noCtx}
                        />

                        {/* Video controls */}
                        {i === mediaIdx && (
                          <div className="absolute inset-0 z-20 flex flex-col justify-between p-2.5">
                            {/* Top row */}
                            <div className="flex items-center justify-between">
                              <VBtn onClick={doTogglePlay}>
                                {videoPlaying
                                  ? <Pause size={14} fill="white" />
                                  : <Play  size={14} fill="white" className="ml-0.5" />}
                              </VBtn>
                              <div className="flex items-center gap-1.5">
                                <div className="flex items-center gap-1 bg-black/40 rounded-full px-2 py-1">
                                  <VBtn onClick={doToggleMute}>
                                    {videoMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                                  </VBtn>
                                  <div className="w-1 h-8 bg-white/20 rounded-full overflow-hidden flex flex-col-reverse">
                                    <div className="w-full bg-white rounded-full transition-all"
                                      style={{ height: videoMuted ? "0%" : "100%" }} />
                                  </div>
                                </div>
                                <VBtn onClick={doFullscreen}><Maximize2 size={13} /></VBtn>
                              </div>
                            </div>

                            {/* Big play overlay */}
                            {!videoPlaying && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-14 h-14 rounded-full bg-black/40 flex items-center justify-center">
                                  <Play size={26} fill="white" className="text-white ml-1" />
                                </div>
                              </div>
                            )}

                            {/* Bottom: time bar */}
                            <div className="flex items-center gap-2">
                              <span className="text-white text-[10px] font-mono shrink-0">{fmtTime(videoCurrent)}</span>
                              <input type="range" min={0} max={videoDuration || 100} value={videoCurrent}
                                onChange={doSeek}
                                onClick={e => e.stopPropagation()}
                                className="flex-1 h-1 appearance-none rounded-full cursor-pointer"
                                style={{ background: `linear-gradient(to right, white ${(videoCurrent / (videoDuration || 1)) * 100}%, rgba(255,255,255,.25) 0%)` }}
                              />
                              <span className="text-white text-[10px] font-mono shrink-0">{fmtTime(videoDuration)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Arrows */}
                {allMedia.length > 1 && mediaIdx > 0 && (
                  <button onClick={e => { e.stopPropagation(); setMediaIdx(p => p - 1); }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-blue-600 z-30">
                    <ChevronLeft size={16} />
                  </button>
                )}
                {allMedia.length > 1 && mediaIdx < allMedia.length - 1 && (
                  <button onClick={e => { e.stopPropagation(); setMediaIdx(p => p + 1); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-blue-600 z-30">
                    <ChevronRight size={16} />
                  </button>
                )}

                {/* Dots */}
                {allMedia.length > 1 && (
                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-1.5 z-30">
                    {allMedia.map((_, i) => (
                      <button key={i} onClick={e => { e.stopPropagation(); setMediaIdx(i); }}
                        className={`rounded-full transition-all ${i === mediaIdx ? "bg-white w-4 h-1.5" : "bg-white/50 w-1.5 h-1.5"}`} />
                    ))}
                  </div>
                )}

                {/* Counter */}
                {allMedia.length > 1 && (
                  <div className="absolute top-2 right-2 z-30">
                    <span className="bg-black/40 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      {mediaIdx + 1}/{allMedia.length}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── ACTION ROW ── */}
            <div className="flex items-center gap-4 mt-2.5 pb-0.5">

              {/* Thoughts — opens quote page */}
              <button onClick={goQuote}
                className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors">
                <MessageCircle size={16} />
                <span className="text-xs font-medium">{fmt(post.thoughts ?? 0)}</span>
              </button>

              {/* Forward */}
              <button onClick={doForward}
                className={`flex items-center gap-1.5 transition-colors ${
                  reposted ? "text-green-500" : "text-gray-400 dark:text-gray-500 hover:text-green-500"
                }`}>
                <RefreshCw size={16} />
                <span className="text-xs font-medium">{fmt(repostCount)}</span>
              </button>

              {/* Praise */}
              <button onClick={doPraise}
                className={`flex items-center gap-1.5 transition-colors ${
                  liked ? "text-orange-500" : "text-gray-400 dark:text-gray-500 hover:text-orange-500"
                }`}>
                <ThumbsUp size={16} className={liked ? "fill-orange-500" : ""} />
                <span className="text-xs font-medium">{fmt(likeCount)}</span>
              </button>

              <div className="flex-1" />

              {/* Bookmark — logged-in only */}
              {isLoggedIn && (
                <button onClick={doBookmark}
                  className={`transition-colors ${
                    saved ? "text-blue-600" : "text-gray-400 dark:text-gray-500 hover:text-blue-500"
                  }`}>
                  <Bookmark size={16} className={saved ? "fill-blue-600" : ""} />
                </button>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          THREE-DOT MENU — position:fixed
          z-[9998] backdrop catches ALL outside clicks
          z-[9999] menu sits above backdrop
      ════════════════════════════════════════════ */}
      {menu && (
        <>
          {/* Backdrop — click anywhere outside closes menu */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={closeMenu}
            onTouchStart={closeMenu}
          />

          <div
            className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden w-48 py-1"
            style={{ left: menu.left, top: menu.top }}
            onClick={e => e.stopPropagation()}
          >
            {isOwn ? (
              /* OWN QUOTE menu */
              <>
                <MItem icon={<RefreshCw size={14} />} label="Requote"              onClick={doRequote} />
                <MItem icon={<Pin size={14} />}        label={post.is_pinned ? "Unpin" : "Pin"} onClick={doPin} />
                <MItem icon={<Share2 size={14} />}     label="Share"               onClick={doShare} />
                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                <MItem icon={<Trash2 size={14} />}     label="Delete"              onClick={doDelete} danger />
                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                <MItem icon={<X size={14} />}          label="Cancel"              onClick={closeMenu} muted />
              </>
            ) : isLoggedIn ? (
              /* OTHER'S QUOTE menu (logged in) */
              <>
                <MItem icon={<RefreshCw size={14} />} label="Requote"                     onClick={doRequote} />
                <MItem icon={<Ban size={14} />}        label={`Block ${displayUsername}`}  onClick={doBlock} danger />
                <MItem icon={<Share2 size={14} />}     label="Share"                      onClick={doShare} />
                <MItem icon={<Flag size={14} />}       label="Report"                     onClick={doReport} danger />
                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                <MItem icon={<X size={14} />}          label="Cancel"                     onClick={closeMenu} muted />
              </>
            ) : (
              /* GUEST menu */
              <>
                <MItem icon={<Share2 size={14} />} label="Share"      onClick={doShare} />
                <MItem icon={<Link2 size={14} />}  label="Copy link"  onClick={doCopyLink} />
                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                <MItem icon={<X size={14} />}      label="Cancel"     onClick={closeMenu} muted />
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

import React, {
  useState, useRef, useMemo, useEffect, useCallback,
} from "react";
import { useNavigate, useLocation } from "react-router";
import {
  MessageCircle, MoreVertical, Bookmark,
  Link2, Share2, X, Shield, UserPlus, Check,
  ChevronLeft, ChevronRight, Play, Volume2, VolumeX,
  Maximize2, Pause, Pin, Trash2, Flag, Ban,
  RefreshCw, ThumbsUp, Minimize2,
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
   TERMINOLOGY MAP  (DB → frontend)
   posts.body            → post.content
   posts.likes_count     → post.likes      / state praiseCount
   posts.forwards_count  → post.reposts    / state fwdCount
   posts.thoughts_count  → post.thoughts
   posts.is_anon         → post.is_anon
   posts.is_pinned       → post.is_pinned
   posts.is_forward      → post.is_forward   (this IS a requote)
   posts.forward_comment → post.forward_comment
   posts.comments_off    → post.comments_off
   post_praises          → "Praise"   (ThumbsUp)
   post_forwards         → "Forward"  (RefreshCw)
   bookmarks             → "Bookmark" (Bookmark icon)
   thoughts              → "Thoughts" (MessageCircle)
   profiles.is_verified  → post.user.isVerified
   profiles.is_org       → post.user.is_org
   post_media rows       → post.mediaItems
══════════════════════════════════════════════════════════════ */

export interface PostCardProps {
  post:           any;
  isLoggedIn?:    boolean;
  isOwn?:         boolean;
  isFollowing?:   boolean;
  currentUserId?: string;
  onDelete?:      (id: string) => void;
}

interface MediaItem {
  type:    "image" | "video";
  url:     string;
  poster?: string;
  width?:  number;
  height?: number;
}

/* ══════════════════════════════════════
   LOCAL STORAGE — media preferences
══════════════════════════════════════ */
const LS_MUTED  = "sphere_vid_muted";
const LS_VOLUME = "sphere_vid_volume";

const lsGet = (k: string, fb: string) => { try { return localStorage.getItem(k) ?? fb; } catch { return fb; } };
const lsSet = (k: string, v: string)  => { try { localStorage.setItem(k, v); } catch {} };

const getMuted  = ()           => lsGet(LS_MUTED,  "true") === "true";
const saveMuted = (v: boolean) => lsSet(LS_MUTED,  String(v));
const getVolume = ()           => parseFloat(lsGet(LS_VOLUME, "1"));
const saveVolume = (v: number) => lsSet(LS_VOLUME, String(v));

/* ══════════════════════════════════════
   FORMATTERS
══════════════════════════════════════ */
const N = (n: number): string =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M"
  : n >= 1_000   ? (n / 1_000).toFixed(1)     + "K"
  : String(n ?? 0);

const Tfmt = (s: number): string =>
  `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

/* ══════════════════════════════════════
   AVATAR
══════════════════════════════════════ */
function Avatar({
  src, name, size = 40, onClick,
}: {
  src?: string | null; name: string; size?: number;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const [err, setErr] = useState(false);
  const initials = (name || "U").split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  const cls = "shrink-0 rounded-full overflow-hidden";
  const style: React.CSSProperties = { width: size, height: size };
  const inner = src && !err ? (
    <img src={src} alt={name} className="w-full h-full object-cover" onError={() => setErr(true)} />
  ) : (
    <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-bold select-none"
      style={{ fontSize: size * 0.36 }}>{initials}</div>
  );
  if (onClick) return <button onClick={onClick} className={cls} style={style}>{inner}</button>;
  return <div className={cls} style={style}>{inner}</div>;
}

/* ══════════════════════════════════════
   MENU ROW
══════════════════════════════════════ */
function MRow({ icon, label, onClick, danger, muted }: {
  icon: React.ReactNode; label: string; onClick: () => void;
  danger?: boolean; muted?: boolean;
}) {
  return (
    <button onClick={onClick} className={[
      "flex items-center gap-3 w-full px-4 py-3 text-[13.5px] font-medium text-left transition-colors active:scale-[0.98]",
      danger ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50"
      : muted ? "text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/60"
      :         "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/60",
    ].join(" ")}>
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
const MDivider = () => <div className="h-px bg-gray-100 dark:bg-gray-700/60 mx-3 my-0.5" />;

/* ══════════════════════════════════════════════════════════════
   FULLSCREEN VIEWER
   • all media swipeable (left/right swipe or arrow keys)
   • swipe DOWN to close
   • Escape key to close
   • media never overflows screen bounds
══════════════════════════════════════════════════════════════ */
function FullscreenViewer({ media, startIdx, onClose }: {
  media: MediaItem[]; startIdx: number; onClose: () => void;
}) {
  const [idx,      setIdx]      = useState(startIdx);
  const [muted,    setMutedSt]  = useState(getMuted());
  const [volume,   setVolumeSt] = useState(getVolume());
  const [playing,  setPlaying]  = useState(false);
  const [current,  setCurrent]  = useState(0);
  const [duration, setDuration] = useState(0);
  const [showVol,  setShowVol]  = useState(false);
  const [flash,    setFlash]    = useState<string | null>(null);
  const videoRef    = useRef<HTMLVideoElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const item = media[idx];

  /* Lock body scroll */
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  /* Keyboard nav */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape")      onClose();
      if (e.key === "ArrowLeft"  && idx > 0)               setIdx(i => i - 1);
      if (e.key === "ArrowRight" && idx < media.length - 1) setIdx(i => i + 1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [idx, media.length, onClose]);

  /* Sync video state */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted; v.volume = volume;
  }, [muted, volume, idx]);

  const doFlash = (k: string) => { setFlash(k); setTimeout(() => setFlash(null), 300); };

  const toggleMute = () => {
    const next = !muted; setMutedSt(next); saveMuted(next); doFlash("mute");
    const v = videoRef.current; if (v) v.muted = next;
  };
  const changeVol = (val: number) => {
    setVolumeSt(val); saveVolume(val);
    const v = videoRef.current;
    if (v) { v.volume = val; if (val === 0) { setMutedSt(true); saveMuted(true); } else { setMutedSt(false); saveMuted(false); } }
  };
  const togglePlay = () => {
    const v = videoRef.current; if (!v) return;
    playing ? v.pause() : v.play(); doFlash("play");
  };
  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current; if (!v) return;
    const t = Number(e.target.value); v.currentTime = t; setCurrent(t);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    if (dy < -60 && Math.abs(dy) > Math.abs(dx)) { onClose(); return; }
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0 && idx < media.length - 1) setIdx(i => i + 1);
      if (dx < 0 && idx > 0)               setIdx(i => i - 1);
    }
  };

  const btnCls = (k: string) =>
    `w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 ${
      flash === k ? "bg-blue-600 text-white" : "bg-black/55 text-white hover:bg-blue-600"
    }`;

  return (
    <div
      className="fixed inset-0 z-[99999] bg-black flex flex-col select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-safe-top py-3 bg-gradient-to-b from-black/70 to-transparent">
        <button onClick={onClose} className={btnCls("close")}><X size={18} /></button>
        {media.length > 1 && (
          <span className="text-white text-xs font-semibold bg-black/40 px-3 py-1 rounded-full">
            {idx + 1} / {media.length}
          </span>
        )}
        <button onClick={onClose} className={btnCls("min")}><Minimize2 size={16} /></button>
      </div>

      {/* Media — constrained to screen */}
      <div className="flex-1 flex items-center justify-center min-h-0 px-2"
        style={{ paddingTop: 56, paddingBottom: item.type === "video" ? 120 : 56 }}>
        {item.type === "image" ? (
          <img
            src={item.url} alt="" draggable={false}
            onContextMenu={e => e.preventDefault()}
            className="max-w-full max-h-full object-contain rounded-xl"
            style={{ maxHeight: "calc(100dvh - 120px)", maxWidth: "100vw" }}
          />
        ) : (
          <video
            ref={videoRef} src={item.url} poster={item.poster}
            muted={muted} loop playsInline
            className="max-w-full max-h-full object-contain rounded-xl"
            style={{ maxHeight: "calc(100dvh - 160px)", maxWidth: "100vw" }}
            onPlay={()  => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onLoadedMetadata={e => setDuration(e.currentTarget.duration || 0)}
            onTimeUpdate={e  => setCurrent(e.currentTarget.currentTime)}
          />
        )}
      </div>

      {/* Left / Right arrows */}
      {idx > 0 && (
        <button onClick={() => setIdx(i => i - 1)}
          className={`${btnCls("prev")} absolute left-3 top-1/2 -translate-y-1/2`}>
          <ChevronLeft size={22} />
        </button>
      )}
      {idx < media.length - 1 && (
        <button onClick={() => setIdx(i => i + 1)}
          className={`${btnCls("next")} absolute right-3 top-1/2 -translate-y-1/2`}>
          <ChevronRight size={22} />
        </button>
      )}

      {/* Dot indicators */}
      {media.length > 1 && (
        <div className="absolute left-1/2 -translate-x-1/2 flex gap-2"
          style={{ bottom: item.type === "video" ? 130 : 24 }}>
          {media.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`rounded-full transition-all ${i === idx ? "bg-white w-5 h-1.5" : "bg-white/40 w-1.5 h-1.5"}`}
            />
          ))}
        </div>
      )}

      {/* Video controls */}
      {item.type === "video" && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-8 pt-12">
          {/* Seek bar */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-white text-[11px] font-mono shrink-0 w-10 text-right">{Tfmt(current)}</span>
            <input type="range" min={0} max={duration || 100} value={current} onChange={seek}
              className="flex-1 h-1.5 rounded-full cursor-pointer appearance-none"
              style={{ background: `linear-gradient(to right,#3b82f6 ${(current/(duration||1))*100}%,rgba(255,255,255,.2) 0%)` }}
            />
            <span className="text-white text-[11px] font-mono shrink-0 w-10">{Tfmt(duration)}</span>
          </div>
          {/* Controls */}
          <div className="flex items-center justify-between">
            <button onClick={togglePlay} className={btnCls("play")}>
              {playing ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" className="ml-0.5" />}
            </button>
            <div className="flex items-center gap-2">
              {showVol && (
                <div className="flex items-center gap-2 bg-black/60 rounded-full px-3 py-2">
                  <input type="range" min={0} max={1} step={0.05} value={volume}
                    onChange={e => changeVol(parseFloat(e.target.value))}
                    className="w-24 h-1.5 rounded-full cursor-pointer appearance-none"
                    style={{ background: `linear-gradient(to right,#3b82f6 ${volume*100}%,rgba(255,255,255,.2) 0%)` }}
                  />
                  <span className="text-white text-[10px] w-7 tabular-nums">{Math.round(volume*100)}%</span>
                </div>
              )}
              <button onClick={() => { toggleMute(); setShowVol(v => !v); }} className={btnCls("mute")}>
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Swipe-down hint */}
      {item.type === "image" && (
        <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/25 text-[10px] pointer-events-none">
          Swipe down to close
        </p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PostCard
══════════════════════════════════════════════════════════════ */
export function PostCard({
  post,
  isLoggedIn   = false,
  isOwn        = false,
  isFollowing  = false,
  currentUserId,
  onDelete,
}: PostCardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const uid      = currentUserId ?? user?.id;
  const quoteUrl = `/quote/${post.id}`;

  /* ── Pop-out animation ── */
  const [popping, setPopping] = useState(false);
  const [removed, setRemoved] = useState(false);
  const startPopOut = useCallback((cb?: () => void) => {
    setPopping(true);
    setTimeout(() => { setRemoved(true); cb?.(); }, 360);
  }, []);

  /* ── Toast ── */
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg); setTimeout(() => setToast(null), 2000);
  }, []);

  /* ── Interaction state ──
     post.isLiked    → DB post_praises row exists for uid
     post.isReposted → DB post_forwards row exists for uid
     post.likes      → DB likes_count
     post.reposts    → DB forwards_count
  ── */
  const [praised,     setPraised]     = useState<boolean>(post.isLiked    ?? false);
  const [forwarded,   setForwarded]   = useState<boolean>(post.isReposted ?? false);
  const [bookmarked,  setBookmarked]  = useState<boolean>(false);
  const [following,   setFollowing]   = useState<boolean>(isFollowing);
  const [praiseCount, setPraiseCount] = useState<number>(post.likes   ?? 0);
  const [fwdCount,    setFwdCount]    = useState<number>(post.reposts ?? 0);
  const [followAnim,  setFollowAnim]  = useState(false);

  useEffect(() => { setFollowing(isFollowing); }, [isFollowing]);

  /* Load bookmark from DB (bookmarks table) */
  useEffect(() => {
    if (!uid || !post.id) return;
    let gone = false;
    supabase.from("bookmarks").select("user_id")
      .eq("user_id", uid).eq("post_id", post.id).maybeSingle()
      .then(({ data }) => { if (!gone && data) setBookmarked(true); });
    return () => { gone = true; };
  }, [uid, post.id]);

  /* ── Three-dot menu ── */
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const dotRef = useRef<HTMLButtonElement>(null);

  const openMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (menuOpen) { setMenuOpen(false); return; }
    const r = dotRef.current?.getBoundingClientRect();
    if (!r) return;
    const W = 215;
    const left = Math.max(8, Math.min(r.right - W, window.innerWidth - W - 8));
    /* Always open BELOW the button — keeping it simple and predictable */
    const top  = Math.min(r.bottom + 6, window.innerHeight - 300);
    setMenuStyle({ position: "fixed", left, top, width: W, zIndex: 9999 });
    setMenuOpen(true);
  }, [menuOpen]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  /* ── Media state ── */
  const [mediaIdx,     setMediaIdx]    = useState(0);
  const [videoPlaying, setVideoPlay]   = useState(false);
  const [videoMuted,   setVideoMuted]  = useState(getMuted);
  const [videoVol,     setVideoVol]    = useState(getVolume);
  const [vidCurrent,   setVidCurrent]  = useState(0);
  const [vidDuration,  setVidDuration] = useState(0);
  const [showVolBar,   setShowVolBar]  = useState(false);
  const [lazyAR,       setLazyAR]      = useState<Record<number, number>>({});
  const [activeBtn,    setActiveBtn]   = useState<string | null>(null);
  const [fullscreen,   setFullscreen]  = useState(false);
  const [swipeSX,      setSwipeSX]     = useState(0);
  const [swipeSY,      setSwipeSY]     = useState(0);
  const [lockedHeight, setLockedH]     = useState<number | null>(null);

  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const outerRef  = useRef<HTMLDivElement>(null);
  const [cardW,   setCardW] = useState(0);

  useEffect(() => {
    const el = outerRef.current; if (!el) return;
    const ro = new ResizeObserver(es => setCardW(es[0]?.contentRect.width ?? 0));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  useEffect(() => {
    videoRefs.current.forEach((v, i) => { if (v && i !== mediaIdx) v.pause(); });
    setVideoPlay(false); setVidCurrent(0); setVidDuration(0);
  }, [mediaIdx]);

  useEffect(() => {
    const v = videoRefs.current[mediaIdx]; if (!v) return;
    v.muted = videoMuted; v.volume = videoVol;
  }, [videoMuted, videoVol, mediaIdx]);

  const allMedia: MediaItem[] = useMemo(() => {
    if (post.mediaItems?.length > 0) return post.mediaItems as MediaItem[];
    const items: MediaItem[] = [];
    if (post.images?.length > 0) post.images.forEach((u: string) => items.push({ type: "image", url: u }));
    else if (post.image) items.push({ type: "image", url: post.image });
    if (post.video) items.push({ type: "video", url: post.video, poster: post.videoPoster });
    return items;
  }, [post]);

  /* Media height — locked after first computation using FIRST media item,
     so it never shifts when user swipes between media */
  const computedH = useMemo(() => {
    const w = cardW || 360;
    const item = allMedia[0]; if (!item) return 0;
    let ar: number | null = null;
    if (item.width && item.height && item.width > 0 && item.height > 0) ar = item.width / item.height;
    else if (lazyAR[0]) ar = lazyAR[0];
    if (ar !== null) {
      const h = w / ar;
      if (ar < 0.75) return Math.min(h, 500);
      if (ar > 1.8)  return Math.min(h, 280);
      if (ar > 1.2)  return Math.min(h, 340);
      return           Math.min(h, 420);
    }
    return item.type === "video" ? 280 : 320;
  }, [cardW, allMedia, lazyAR]);

  useEffect(() => { if (lockedHeight === null && computedH > 0) setLockedH(computedH); }, [computedH, lockedHeight]);
  const mediaHeight = lockedHeight ?? computedH;

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>, i: number) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    if (w && h && !allMedia[i]?.width) setLazyAR(p => ({ ...p, [i]: w / h }));
  };
  const onVideoMeta = (e: React.SyntheticEvent<HTMLVideoElement>, i: number) => {
    const { videoWidth: w, videoHeight: h } = e.currentTarget;
    if (w && h && !allMedia[i]?.width) setLazyAR(p => ({ ...p, [i]: w / h }));
    if (i === mediaIdx) setVidDuration(e.currentTarget.duration || 0);
  };

  /* Smooth real-time swipe on media */
  const onTS = (e: React.TouchEvent) => { setSwipeSX(e.targetTouches[0].clientX); setSwipeSY(e.targetTouches[0].clientY); };
  const onTE = (e: React.TouchEvent) => {
    const dx = swipeSX - e.changedTouches[0].clientX;
    const dy = swipeSY - e.changedTouches[0].clientY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx > 0 && mediaIdx < allMedia.length - 1) setMediaIdx(p => p + 1);
      else if (dx < 0 && mediaIdx > 0)              setMediaIdx(p => p - 1);
    }
  };

  const noCtx  = (e: React.SyntheticEvent) => e.preventDefault();
  const flashB = (k: string) => { setActiveBtn(k); setTimeout(() => setActiveBtn(null), 280); };

  const vidTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation(); flashB("play");
    const v = videoRefs.current[mediaIdx]; if (!v) return;
    videoPlaying ? v.pause() : v.play();
  };
  const vidToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation(); flashB("mute");
    const next = !videoMuted; setVideoMuted(next); saveMuted(next);
    setShowVolBar(s => !s);
    const v = videoRefs.current[mediaIdx]; if (v) v.muted = next;
  };
  const vidChangeVol = (val: number) => {
    setVideoVol(val); saveVolume(val);
    const v = videoRefs.current[mediaIdx];
    if (v) { v.volume = val; const m = val === 0; setVideoMuted(m); saveMuted(m); }
  };
  const vidSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const v = videoRefs.current[mediaIdx]; if (!v) return;
    const t = Number(e.target.value); v.currentTime = t; setVidCurrent(t);
  };
  const openFullscreen = (e: React.MouseEvent, i: number) => {
    e.stopPropagation(); flashB("full"); setMediaIdx(i); setFullscreen(true);
  };

  const vBtnCls = (k: string) =>
    `w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 ${
      activeBtn === k ? "bg-blue-600 text-white shadow-md shadow-blue-600/40" : "bg-black/55 text-white hover:bg-blue-600"
    }`;

  /* ── Auth guard ── */
  const guard = useCallback((fn: () => void) => {
    if (!isLoggedIn) { navigate("/login"); return; }
    fn();
  }, [isLoggedIn, navigate]);

  /* ── Navigation ── */
  const goProfile = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn)   { navigate("/login"); return; }
    if (post.is_anon)  return;
    if (isOwn)         { navigate("/profile"); return; }
    if (post.user?.id) navigate(`/user/${post.user.id}`);
  }, [isLoggedIn, isOwn, post.is_anon, post.user?.id, navigate]);

  const goMention = async (e: React.MouseEvent, raw: string) => {
    e.stopPropagation();
    if (!isLoggedIn) { navigate("/login"); return; }
    const u = raw.replace(/^@/, "").toLowerCase();
    const { data } = await supabase.from("profiles").select("id").ilike("username", u).maybeSingle();
    if (data?.id) navigate(`/user/${data.id}`);
  };

  /* ── Actions ── */
  const doPraise = (e: React.MouseEvent) => {
    e.stopPropagation();
    guard(() => {
      const was = praised;
      setPraised(!was); setPraiseCount(c => was ? Math.max(0, c - 1) : c + 1);
      if (!uid) return;
      togglePraise(post.id, uid, was).catch(() => {
        setPraised(was); setPraiseCount(c => was ? c + 1 : Math.max(0, c - 1));
      });
    });
  };

  const doForward = (e: React.MouseEvent) => {
    e.stopPropagation();
    guard(() => {
      const was = forwarded;
      setForwarded(!was); setFwdCount(c => was ? Math.max(0, c - 1) : c + 1);
      if (!uid) return;
      toggleForward(post.id, uid, was).catch(() => {
        setForwarded(was); setFwdCount(c => was ? c + 1 : Math.max(0, c - 1));
      });
    });
  };

  const doBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    guard(() => {
      const was = bookmarked; setBookmarked(!was);
      if (!uid) return;
      toggleBookmark(post.id, uid, was).catch(() => setBookmarked(was));
    });
  };

  const doFollow = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isLoggedIn) { navigate("/login"); return; }
    if (!uid || !post.user?.id) return;
    const was = following; setFollowing(!was);
    if (!was) {
      setFollowAnim(true); setTimeout(() => setFollowAnim(false), 1800);
      const { error } = await supabase.from("follows")
        .insert({ follower_id: uid, following_id: post.user.id });
      if (error) setFollowing(false);
    } else {
      await supabase.from("follows").delete()
        .eq("follower_id", uid).eq("following_id", post.user.id);
    }
  };

  const doDelete = () => {
    closeMenu();
    if (!uid) return;
    startPopOut(() => {
      onDelete?.(post.id);
      if (location.pathname.startsWith("/quote/")) navigate(-1);
    });
    deletePost(post.id, uid).catch(err => console.error("[PostCard] delete:", err));
  };

  const doBlock = async () => {
    closeMenu();
    if (!uid || !post.user?.id) return;
    /* Remove all this user's posts from the feed silently */
    startPopOut(() => {
      onDelete?.(post.id);
      if (location.pathname.startsWith("/quote/")) navigate(-1);
    });
    try { await blockUser(uid, post.user.id); }
    catch (err) { console.error("[PostCard] block:", err); }
  };

  const doRequote = () => { closeMenu(); guard(() => navigate(`/create-post?requote=${post.id}`)); };

  const doPin = async () => {
    closeMenu();
    if (!uid) return;
    await supabase.from("posts").update({ is_pinned: !post.is_pinned })
      .eq("id", post.id).eq("user_id", uid);
  };

  const doShare = () => {
    closeMenu();
    const url = `${window.location.origin}/quote/${post.id}`;
    if (navigator.share) navigator.share({ url }).catch(() => {});
    else { navigator.clipboard?.writeText(url); showToast("Link copied!"); }
  };

  const doReport = () => { closeMenu(); navigate(`/report/${post.id}`); };
  const goQuote  = (e: React.MouseEvent) => { e.stopPropagation(); navigate(quoteUrl); };

  /* Display strings */
  const displayName  = post.is_anon ? "Anonymous"  : (post.user?.name     || "User");
  const displayUname = post.is_anon ? ""            : (post.user?.username || "");
  const timeStr      = post.timestamp || "";

  if (removed) return null;

  const popStyle: React.CSSProperties = popping ? {
    animation: "pcPopOut 360ms cubic-bezier(.4,0,.6,1) forwards",
    overflow: "hidden", pointerEvents: "none",
  } : {};

  /* ════════════════════════════════════════════════════════════
     SHARED PIECES
  ════════════════════════════════════════════════════════════ */

  /* Quote text */
  const QuoteText = post.content ? (
    <p onClick={goQuote}
      className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed break-words cursor-pointer mt-0.5">
      {post.content.split(/(\s+)/).map((token: string, i: number) => {
        const t = token.trim();
        if (t.startsWith("#") && t.length > 1) return (
          <span key={i}
            onClick={e => { e.stopPropagation(); navigate(isLoggedIn ? `/feed/search?q=${encodeURIComponent(t)}` : `/search?q=${encodeURIComponent(t)}`); }}
            className="text-blue-500 hover:underline cursor-pointer">{token}</span>
        );
        if (t.startsWith("@") && t.length > 1) return (
          <span key={i} onClick={e => goMention(e, t)}
            className="text-blue-500 hover:underline cursor-pointer font-medium">{token}</span>
        );
        return token;
      })}
    </p>
  ) : null;

  /* Requote embed — DB: posts.is_forward = true, posts.forward_of = uuid */
  const RequoteEmbed = post.is_forward && post.originalPost ? (
    <div onClick={e => { e.stopPropagation(); navigate(`/quote/${post.originalPost.id}`); }}
      className="mt-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
      {post.forward_comment && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 italic">"{post.forward_comment}"</p>
      )}
      <div className="flex items-center gap-2 mb-1">
        <Avatar src={post.originalPost.user?.avatar} name={post.originalPost.user?.name || "User"} size={18} />
        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{post.originalPost.user?.name}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">{post.originalPost.user?.username}</span>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3">{post.originalPost.content}</p>
    </div>
  ) : null;

  /* Media carousel — DB: post_media rows */
  const MediaCarousel = allMedia.length > 0 ? (
    <div ref={outerRef}
      className="mt-2 rounded-2xl overflow-hidden relative select-none bg-black"
      style={{ height: mediaHeight > 0 ? `${mediaHeight}px` : undefined, minHeight: "120px" }}
      onTouchStart={onTS} onTouchEnd={onTE}>

      {allMedia.map((item, i) => (
        <div key={i} className="absolute inset-0 w-full h-full"
          style={{
            transform:  `translateX(${(i - mediaIdx) * 100}%)`,
            transition: "transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)",
            willChange: "transform",
          }}>

          {item.type === "image" ? (
            /* IMAGE */
            <div className="relative w-full h-full overflow-hidden" onContextMenu={noCtx}>
              {/* Cinematic blur bg */}
              <img src={item.url} aria-hidden draggable={false}
                className="absolute inset-0 w-full h-full object-cover scale-110 pointer-events-none"
                style={{ filter: "blur(20px) brightness(.35) saturate(1.6)" }}
                onContextMenu={noCtx} />
              {/* Main image — click opens quote page (text area), NOT fullscreen */}
              <img src={item.url} alt="" draggable={false}
                className="relative z-10 w-full h-full object-contain"
                onLoad={e => onImgLoad(e, i)}
                onContextMenu={noCtx} />
              {/* Fullscreen button on image */}
              <button onClick={e => openFullscreen(e, i)}
                className="absolute top-2 right-2 z-20 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-blue-600 transition-colors active:scale-90">
                <Maximize2 size={13} />
              </button>
            </div>
          ) : (
            /* VIDEO */
            <div className="relative w-full h-full overflow-hidden bg-black" onContextMenu={noCtx}>
              {item.poster && (
                <img src={item.poster} aria-hidden draggable={false}
                  className="absolute inset-0 w-full h-full object-cover scale-110"
                  style={{ filter: "blur(18px) brightness(.3) saturate(1.6)" }}
                  onContextMenu={noCtx} />
              )}
              <video
                ref={el => {
                  videoRefs.current[i] = el;
                  if (el) { (el as any).disableRemotePlayback = true; el.muted = videoMuted; el.volume = videoVol; }
                }}
                src={item.url} poster={item.poster}
                muted={videoMuted} loop playsInline
                className="relative z-10 w-full h-full object-contain"
                onLoadedMetadata={e => onVideoMeta(e, i)}
                onPlay={()  => i === mediaIdx && setVideoPlay(true)}
                onPause={() => i === mediaIdx && setVideoPlay(false)}
                onTimeUpdate={e => { if (i === mediaIdx) setVidCurrent(e.currentTarget.currentTime); }}
                onContextMenu={noCtx} />

              {/* Video controls overlay — active slide only */}
              {i === mediaIdx && (
                <div className="absolute inset-0 z-20 flex flex-col justify-between p-2.5 pointer-events-none">
                  {/* TOP ROW: Play/Pause (left) | Volume + Fullscreen (right) */}
                  <div className="flex items-center justify-between pointer-events-auto">
                    <button onClick={vidTogglePlay} className={vBtnCls("play")}>
                      {videoPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" className="ml-0.5" />}
                    </button>
                    <div className="flex items-center gap-1.5">
                      {showVolBar && (
                        <div className="flex items-center gap-1.5 bg-black/60 rounded-full px-2.5 py-1">
                          <input type="range" min={0} max={1} step={0.05} value={videoVol}
                            onChange={e => vidChangeVol(parseFloat(e.target.value))}
                            onClick={e => e.stopPropagation()}
                            className="w-16 h-1 rounded-full appearance-none cursor-pointer"
                            style={{ background: `linear-gradient(to right,#3b82f6 ${videoVol*100}%,rgba(255,255,255,.25) 0%)` }} />
                          <span className="text-white text-[9px] tabular-nums w-5">{Math.round(videoVol*100)}%</span>
                        </div>
                      )}
                      <button onClick={vidToggleMute} className={vBtnCls("mute")}>
                        {videoMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                      </button>
                      <button onClick={e => openFullscreen(e, i)} className={vBtnCls("full")}>
                        <Maximize2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Centre: big play icon when paused */}
                  {!videoPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-14 h-14 rounded-full bg-black/40 flex items-center justify-center">
                        <Play size={26} fill="white" className="text-white ml-1" />
                      </div>
                    </div>
                  )}

                  {/* BOTTOM: seek bar + timestamps */}
                  <div className="flex items-center gap-2 pointer-events-auto">
                    <span className="text-white text-[10px] font-mono shrink-0">{Tfmt(vidCurrent)}</span>
                    <input type="range" min={0} max={vidDuration || 100} value={vidCurrent}
                      onChange={vidSeek} onClick={e => e.stopPropagation()}
                      className="flex-1 h-1 appearance-none rounded-full cursor-pointer"
                      style={{ background: `linear-gradient(to right,#3b82f6 ${(vidCurrent/(vidDuration||1))*100}%,rgba(255,255,255,.25) 0%)` }} />
                    <span className="text-white text-[10px] font-mono shrink-0">{Tfmt(vidDuration)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Prev / Next arrows — hover turns blue */}
      {allMedia.length > 1 && mediaIdx > 0 && (
        <button onClick={e => { e.stopPropagation(); setMediaIdx(p => p - 1); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-blue-600 active:bg-blue-700 z-30 transition-colors">
          <ChevronLeft size={16} />
        </button>
      )}
      {allMedia.length > 1 && mediaIdx < allMedia.length - 1 && (
        <button onClick={e => { e.stopPropagation(); setMediaIdx(p => p + 1); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-blue-600 active:bg-blue-700 z-30 transition-colors">
          <ChevronRight size={16} />
        </button>
      )}

      {/* Dot indicators */}
      {allMedia.length > 1 && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-1.5 z-30">
          {allMedia.map((_, i) => (
            <button key={i} onClick={e => { e.stopPropagation(); setMediaIdx(i); }}
              className={`rounded-full transition-all ${i === mediaIdx ? "bg-white w-4 h-1.5" : "bg-white/50 w-1.5 h-1.5"}`} />
          ))}
        </div>
      )}

      {/* Counter badge */}
      {allMedia.length > 1 && (
        <div className="absolute top-2 left-2 z-30">
          <span className="bg-black/40 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
            {mediaIdx + 1} / {allMedia.length}
          </span>
        </div>
      )}
    </div>
  ) : null;

  /* Action bar ── LEFT: Thoughts | Forward | Praise   RIGHT: Bookmark */
  const ActionBar = (
    <div className="flex items-center mt-2.5">
      {/* Thoughts — clicking opens quote/thoughts page */}
      {!post.comments_off && (
        <button onClick={goQuote}
          className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors mr-5">
          <MessageCircle size={16} />
          <span className="text-xs font-medium tabular-nums">{N(post.thoughts ?? 0)}</span>
        </button>
      )}

      {/* Forward (DB: post_forwards) */}
      <button onClick={doForward}
        className={`flex items-center gap-1.5 transition-colors mr-5 ${
          forwarded ? "text-green-500" : "text-gray-400 dark:text-gray-500 hover:text-green-500"
        }`}>
        <RefreshCw size={16} />
        <span className="text-xs font-medium tabular-nums">{N(fwdCount)}</span>
      </button>

      {/* Praise (DB: post_praises) */}
      <button onClick={doPraise}
        className={`flex items-center gap-1.5 transition-colors ${
          praised ? "text-orange-500" : "text-gray-400 dark:text-gray-500 hover:text-orange-500"
        }`}>
        <ThumbsUp size={16} className={praised ? "fill-orange-500" : ""} />
        <span className="text-xs font-medium tabular-nums">{N(praiseCount)}</span>
      </button>

      <div className="flex-1" />

      {/* Bookmark — right side, logged-in only (DB: bookmarks) */}
      {isLoggedIn && (
        <button onClick={doBookmark}
          className={`transition-colors ${
            bookmarked ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500 hover:text-blue-500"
          }`}>
          <Bookmark size={16} className={bookmarked ? "fill-blue-600 dark:fill-blue-400" : ""} />
        </button>
      )}
    </div>
  );

  /* ════════════════════════════════════════════════════════════
     CARD WRAPPER — shared for OWN and OTHERS
     headerControls is the only thing that differs in the header
  ════════════════════════════════════════════════════════════ */
  const renderCard = (headerControls: React.ReactNode) => (
    <>
      <style>{`
        @keyframes pcPopOut {
          0%   { opacity:1; transform:scale(1); max-height:900px }
          30%  { opacity:.5; transform:scale(1.015) }
          100% { opacity:0; transform:scale(.88); max-height:0; padding:0; border:none }
        }
        @keyframes followBadge {
          0%   { opacity:0; transform:translateY(6px) scale(.85) }
          20%  { opacity:1; transform:translateY(0) scale(1.05) }
          65%  { opacity:1 }
          100% { opacity:0; transform:translateY(-10px) scale(.9) }
        }
      `}</style>

      <div
        className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 relative"
        style={popStyle}
      >
        {/* Toast notification */}
        {toast && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none
            bg-gray-900 dark:bg-gray-700 text-white text-[12px] font-semibold
            px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap">
            {toast}
          </div>
        )}

        {/* Follow animation badge */}
        {followAnim && (
          <div
            className="absolute top-3 right-12 z-20 flex items-center gap-1 bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg pointer-events-none"
            style={{ animation: "followBadge 1.8s ease-out forwards" }}>
            <Check size={11} /> Following!
          </div>
        )}

        {/* Pinned label (own posts only) */}
        {post.is_pinned && isOwn && (
          <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-0">
            <Pin size={11} className="text-blue-500" />
            <span className="text-[11px] text-blue-500 font-semibold tracking-wide">Pinned Quote</span>
          </div>
        )}

        {/* ── MAIN ROW ── */}
        <div className="flex gap-3 px-4 pt-3 pb-3">

          {/* Avatar — left column */}
          <div className="shrink-0 pt-0.5">
            {post.is_anon ? (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center cursor-default">
                <Shield size={18} className="text-white" />
              </div>
            ) : (
              <Avatar src={post.user?.avatar} name={displayName} size={40} onClick={goProfile} />
            )}
          </div>

          {/* Right content column */}
          <div className="flex-1 min-w-0">

            {/* HEADER: [Name · @username · time] + [headerControls] */}
            <div className="flex items-start justify-between gap-2 mb-1.5">

              {/* Name block — entire block clickable → profile */}
              <button onClick={goProfile} className="text-left min-w-0 flex-1 group">
                {/* Row 1: Full name + badges */}
                <div className="flex items-center gap-1 flex-wrap leading-tight">
                  <span className="font-bold text-gray-900 dark:text-white text-sm group-hover:underline truncate max-w-[160px]">
                    {displayName}
                  </span>
                  {/* Verified badge (DB: profiles.is_verified) */}
                  {post.user?.isVerified && !post.is_anon && (
                    <span className="inline-flex items-center justify-center w-[15px] h-[15px] bg-blue-500 rounded-full shrink-0">
                      <Check size={9} className="text-white" strokeWidth={3} />
                    </span>
                  )}
                  {/* Org badge (DB: profiles.is_org) */}
                  {post.user?.is_org && !post.is_anon && (
                    <span className="inline-flex items-center justify-center w-[15px] h-[15px] bg-purple-500 rounded-full shrink-0">
                      <Check size={9} className="text-white" strokeWidth={3} />
                    </span>
                  )}
                  {/* Anon tag */}
                  {post.is_anon && (
                    <span className="text-[10px] bg-gray-700 dark:bg-gray-600 text-gray-300 px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                      anon
                    </span>
                  )}
                </div>
                {/* Row 2: @username · time */}
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">
                  {post.is_anon ? timeStr : `${displayUname} · ${timeStr}`}
                </div>
              </button>

              {/* Header right controls (Follow btn + ⋮ for others, just ⋮ for own) */}
              {headerControls}
            </div>

            {/* Quote text → clicking opens quote/thoughts page */}
            {QuoteText}

            {/* Requote embed */}
            {RequoteEmbed}

            {/* Media carousel */}
            {MediaCarousel}

            {/* Action bar: Thoughts | Forward | Praise … Bookmark */}
            {ActionBar}

          </div>
        </div>
      </div>

      {/* THREE-DOT MENU — fixed position, appears just below the button */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-[9998]"
            onClick={closeMenu}
            onTouchStart={e => { e.preventDefault(); closeMenu(); }} />
          <div
            className="z-[9999] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden py-1.5"
            style={menuStyle}
            onClick={e => e.stopPropagation()}>

            {isOwn ? (
              /* ══ OWN POST MENU ══ */
              <>
                <MRow icon={<RefreshCw size={15} />} label="Requote" onClick={doRequote} />
                <MRow icon={<Pin size={15} />} label={post.is_pinned ? "Unpin from profile" : "Pin to profile"} onClick={doPin} />
                <MRow icon={<Share2 size={15} />} label="Share" onClick={doShare} />
                <MDivider />
                <MRow icon={<Trash2 size={15} />} label="Delete Quote" onClick={doDelete} danger />
                <MDivider />
                <MRow icon={<X size={15} />} label="Cancel" onClick={closeMenu} muted />
              </>
            ) : isLoggedIn ? (
              /* ══ OTHERS' POST MENU (logged-in) ══ */
              <>
                <MRow icon={<RefreshCw size={15} />} label="Requote" onClick={doRequote} />
                {!post.is_anon && (
                  <MRow
                    icon={following ? <Check size={15} /> : <UserPlus size={15} />}
                    label={following ? `Unfollow ${displayUname}` : `Follow ${displayUname}`}
                    onClick={() => { closeMenu(); doFollow(); }}
                  />
                )}
                <MRow icon={<Share2 size={15} />} label="Share" onClick={doShare} />
                <MDivider />
                <MRow icon={<Flag size={15} />} label="Report" onClick={doReport} danger />
                {!post.is_anon && (
                  <MRow icon={<Ban size={15} />} label={`Block ${displayUname}`} onClick={doBlock} danger />
                )}
                <MDivider />
                <MRow icon={<X size={15} />} label="Cancel" onClick={closeMenu} muted />
              </>
            ) : (
              /* ══ GUEST MENU ══ */
              <>
                <MRow icon={<Share2 size={15} />} label="Share" onClick={doShare} />
                <MDivider />
                <MRow icon={<X size={15} />} label="Cancel" onClick={closeMenu} muted />
              </>
            )}
          </div>
        </>
      )}

      {/* Fullscreen viewer */}
      {fullscreen && allMedia.length > 0 && (
        <FullscreenViewer
          media={allMedia}
          startIdx={mediaIdx}
          onClose={() => setFullscreen(false)}
        />
      )}
    </>
  );

  /* ══════════════════════════════════════════════════════════════
     OWN POST — no Follow button, just ⋮
  ══════════════════════════════════════════════════════════════ */
  if (isOwn) {
    return renderCard(
      <button ref={dotRef} onClick={openMenu}
        className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0 mt-0.5">
        <MoreVertical size={17} />
      </button>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     OTHERS' POST — Follow/Following button + ⋮
  ══════════════════════════════════════════════════════════════ */
  return renderCard(
    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
      {isLoggedIn && !post.is_anon && (
        <button onClick={e => doFollow(e)}
          className={[
            "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all active:scale-95",
            following
              ? "border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50"
              : "border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50",
          ].join(" ")}>
          {following
            ? <><Check size={11} /><span className="ml-0.5">Following</span></>
            : <><UserPlus size={11} /><span className="ml-0.5">Follow</span></>
          }
        </button>
      )}
      <button ref={dotRef} onClick={openMenu}
        className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <MoreVertical size={17} />
      </button>
    </div>
  );
}

import React, {
  useState, useRef, useMemo, useEffect, useCallback,
} from "react";
import { useNavigate, useLocation } from "react-router";
import {
  MessageCircle, MoreVertical, Bookmark,
  Link2, Share2, X, Shield, UserPlus, Check,
  ChevronLeft, ChevronRight, Play, Volume2, VolumeX,
  Maximize2, Pause, Pin, Trash2, Flag, Ban,
  RefreshCw, ThumbsUp, Minimize2, Eye, MapPin,
  Hash, MessageSquare, Building2, AlertCircle,
} from "lucide-react";
import { useAuth }          from "../contexts/AuthContext";
import { supabase }         from "../lib/supabase";
import {
  togglePraise, toggleForward, toggleBookmark,
  deletePost, blockUser,
} from "../services/feedService";

/* ══════════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════════ */
export interface PostCardProps {
  post:            any;
  isLoggedIn?:     boolean;
  isOwn?:          boolean;
  isFollowing?:    boolean;
  currentUserId?:  string;
  onDelete?:       (id: string) => void;
  showPin?:        boolean;   // true only on ProfilePage
  societyHandle?:  string;    // Phase 3: badge shows when post is from society
  societyName?:    string;
}

interface MediaItem { type: "image"|"video"; url: string; poster?: string; width?: number; height?: number; }
interface PollOption { text: string; }
interface PollData   { id: string; options: PollOption[]; ends_at: string; duration_hours: number; }

/* ══════════════════════════════════════════════════════════════
   LOCAL STORAGE — video preferences
══════════════════════════════════════════════════════════════ */
const lsGet    = (k: string, fb: string) => { try { return localStorage.getItem(k) ?? fb; } catch { return fb; } };
const lsSet    = (k: string, v: string)  => { try { localStorage.setItem(k, v); } catch {} };
const getMuted  = () => lsGet("sphere_vid_muted",  "true") === "true";
const saveMuted = (v: boolean) => lsSet("sphere_vid_muted",  String(v));
const getVolume = () => parseFloat(lsGet("sphere_vid_volume", "1"));
const saveVolume = (v: number) => lsSet("sphere_vid_volume", String(v));

/* ══════════════════════════════════════════════════════════════
   FORMATTERS
══════════════════════════════════════════════════════════════ */
const N    = (n: number): string =>
  n >= 1_000_000 ? (n/1_000_000).toFixed(1)+"M" : n >= 1_000 ? (n/1_000).toFixed(1)+"K" : String(n ?? 0);
const Tfmt = (s: number): string =>
  `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,"0")}`;

/* ══════════════════════════════════════════════════════════════
   AVATAR
══════════════════════════════════════════════════════════════ */
function Avatar({ src, name, size=40, onClick }: {
  src?: string|null; name: string; size?: number;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const [err, setErr] = useState(false);
  const initials = (name||"U").split(" ").map(w=>w[0]??"").join("").slice(0,2).toUpperCase();
  const cls   = "shrink-0 rounded-full overflow-hidden";
  const style: React.CSSProperties = { width: size, height: size };
  const inner = src && !err
    ? <img src={src} alt={name} className="w-full h-full object-cover" onError={() => setErr(true)} />
    : <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-bold select-none"
        style={{ fontSize: size*0.36 }}>{initials}</div>;
  if (onClick) return <button onClick={onClick} className={cls} style={style}>{inner}</button>;
  return <div className={cls} style={style}>{inner}</div>;
}

/* ══════════════════════════════════════════════════════════════
   MENU ROW
══════════════════════════════════════════════════════════════ */
function MRow({ icon, label, onClick, danger, muted }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; muted?: boolean;
}) {
  return (
    <button onClick={onClick} className={[
      "flex items-center gap-3 w-full px-4 py-3 text-[13.5px] font-medium text-left transition-colors active:scale-[0.98]",
      danger ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50"
      : muted ? "text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/60"
      :         "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/60",
    ].join(" ")}>
      <span className="shrink-0">{icon}</span><span>{label}</span>
    </button>
  );
}
const MDivider = () => <div className="h-px bg-gray-100 dark:bg-gray-700/60 mx-3 my-0.5" />;

/* ══════════════════════════════════════════════════════════════
   POLL CARD
══════════════════════════════════════════════════════════════ */
function PollCard({ postId, isLoggedIn, currentUserId }: {
  postId: string; isLoggedIn: boolean; currentUserId?: string;
}) {
  const navigate = useNavigate();
  const [poll,       setPoll]       = useState<PollData|null>(null);
  const [votes,      setVotes]      = useState<Record<number,number>>({}); // optionIdx → voteCount
  const [myVote,     setMyVote]     = useState<number|null>(null);
  const [voting,     setVoting]     = useState(false);
  const [totalVotes, setTotal]      = useState(0);

  useEffect(() => {
    let gone = false;
    (async () => {
      const { data: pollData } = await supabase.from("post_polls").select("id,options,ends_at,duration_hours").eq("post_id", postId).maybeSingle();
      if (!pollData || gone) return;
      setPoll(pollData as PollData);

      // Vote counts from poll_votes
      const { data: voteData } = await supabase.from("poll_votes").select("option_idx").eq("poll_id", pollData.id);
      const counts: Record<number,number> = {};
      let total = 0;
      (voteData||[]).forEach((r: any) => { counts[r.option_idx] = (counts[r.option_idx]||0)+1; total++; });
      if (!gone) { setVotes(counts); setTotal(total); }

      // Check if current user voted
      if (currentUserId) {
        const { data: myVoteData } = await supabase.from("poll_votes").select("option_idx")
          .eq("poll_id", pollData.id).eq("user_id", currentUserId).maybeSingle();
        if (!gone && myVoteData) setMyVote(myVoteData.option_idx);
      }
    })();
    return () => { gone = true; };
  }, [postId, currentUserId]);

  if (!poll) return null;

  const expired   = new Date(poll.ends_at) < new Date();
  const hasVoted  = myVote !== null;
  const showResults = hasVoted || expired;

  const handleVote = async (idx: number) => {
    if (!isLoggedIn) { navigate("/login"); return; }
    if (!currentUserId || voting || hasVoted || expired) return;
    setVoting(true);
    setMyVote(idx);
    setVotes(prev => ({ ...prev, [idx]: (prev[idx]||0)+1 }));
    setTotal(t => t+1);
    await supabase.from("poll_votes").upsert(
      { poll_id: poll.id, user_id: currentUserId, option_idx: idx },
      { onConflict: "user_id,poll_id", ignoreDuplicates: true }
    );
    setVoting(false);
  };

  const options = (poll.options as PollOption[]);
  const timeLeft = () => {
    const diff = new Date(poll.ends_at).getTime() - Date.now();
    if (diff <= 0) return "Ended";
    const h = Math.floor(diff/3600000);
    const d = Math.floor(h/24);
    if (d > 0) return `${d}d left`;
    return `${h}h left`;
  };

  return (
    <div className="mt-3 border border-blue-100 dark:border-blue-900/40 rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
      <div className="bg-blue-50 dark:bg-blue-950/30 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BarChart2Icon />
          <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Poll</span>
        </div>
        <span className="text-[10px] text-blue-500 dark:text-blue-400 font-medium">{timeLeft()}</span>
      </div>
      <div className="p-3 space-y-2">
        {options.map((opt, i) => {
          const count   = votes[i] || 0;
          const pct     = totalVotes > 0 ? Math.round((count/totalVotes)*100) : 0;
          const isWinner = showResults && count === Math.max(...Object.values(votes), 0) && count > 0;
          const isMyVote = myVote === i;
          return (
            <button key={i} onClick={() => handleVote(i)} disabled={showResults || voting}
              className={`relative w-full text-left rounded-xl overflow-hidden border-2 transition-all ${
                isMyVote ? "border-blue-500" : showResults ? "border-gray-100 dark:border-gray-800" : "border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600"
              }`}>
              {/* Progress bar background */}
              {showResults && (
                <div className={`absolute inset-0 rounded-xl transition-all ${isWinner ? "bg-blue-100 dark:bg-blue-950/50" : "bg-gray-50 dark:bg-gray-800/50"}`}
                  style={{ width: `${pct}%` }} />
              )}
              <div className="relative flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  {isMyVote && <Check size={12} className="text-blue-500 shrink-0" />}
                  <span className={`text-sm font-medium ${isWinner && showResults ? "text-blue-700 dark:text-blue-300 font-bold" : "text-gray-800 dark:text-gray-200"}`}>
                    {opt.text}
                  </span>
                </div>
                {showResults && (
                  <span className={`text-xs font-bold tabular-nums ${isWinner ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}`}>
                    {pct}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
        <p className="text-[10px] text-gray-400 dark:text-gray-600 text-center pt-0.5">
          {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
          {!showResults && !expired && " · Tap to vote"}
          {expired && " · Poll ended"}
        </p>
      </div>
    </div>
  );
}
function BarChart2Icon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 dark:text-blue-400">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   FULLSCREEN VIEWER
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
  const [flash,    setFlash]    = useState<string|null>(null);
  const videoRef   = useRef<HTMLVideoElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const item = media[idx];

  useEffect(() => { document.body.style.overflow="hidden"; return () => { document.body.style.overflow=""; }; }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key==="Escape") onClose();
      if (e.key==="ArrowLeft"  && idx>0)               setIdx(i=>i-1);
      if (e.key==="ArrowRight" && idx<media.length-1)  setIdx(i=>i+1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [idx, media.length, onClose]);

  useEffect(() => {
    const v = videoRef.current; if (!v) return; v.muted=muted; v.volume=volume;
  }, [muted, volume, idx]);

  const doFlash  = (k: string) => { setFlash(k); setTimeout(()=>setFlash(null),300); };
  const btnCls   = (k: string) => `w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 ${flash===k?"bg-blue-600 text-white":"bg-black/55 text-white hover:bg-blue-600"}`;

  const toggleMute = () => {
    const next=!muted; setMutedSt(next); saveMuted(next); doFlash("mute");
    const v=videoRef.current; if(v) v.muted=next;
  };
  const togglePlay = () => {
    const v=videoRef.current; if(!v) return; playing?v.pause():v.play(); doFlash("play");
  };
  const changeVol = (val: number) => {
    setVolumeSt(val); saveVolume(val);
    const v=videoRef.current;
    if(v){v.volume=val; if(val===0){setMutedSt(true);saveMuted(true);}else{setMutedSt(false);saveMuted(false);}}
  };
  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v=videoRef.current; if(!v) return;
    const t=Number(e.target.value); v.currentTime=t; setCurrent(t);
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black flex flex-col select-none"
      onTouchStart={e=>{touchStartX.current=e.touches[0].clientX;touchStartY.current=e.touches[0].clientY;}}
      onTouchEnd={e=>{
        const dx=touchStartX.current-e.changedTouches[0].clientX;
        const dy=touchStartY.current-e.changedTouches[0].clientY;
        if(dy<-60&&Math.abs(dy)>Math.abs(dx)){onClose();return;}
        if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)){
          if(dx>0&&idx<media.length-1)setIdx(i=>i+1);
          if(dx<0&&idx>0)setIdx(i=>i-1);
        }
      }}>
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-safe-top py-3 bg-gradient-to-b from-black/70 to-transparent">
        <button onClick={onClose} className={btnCls("close")}><X size={18}/></button>
        {media.length>1 && <span className="text-white text-xs font-semibold bg-black/40 px-3 py-1 rounded-full">{idx+1}/{media.length}</span>}
        <button onClick={onClose} className={btnCls("min")}><Minimize2 size={16}/></button>
      </div>
      {/* Media */}
      <div className="flex-1 flex items-center justify-center min-h-0 px-2"
        style={{paddingTop:56,paddingBottom:item.type==="video"?120:56}}>
        {item.type==="image"
          ? <img src={item.url} alt="" draggable={false} className="max-w-full max-h-full object-contain rounded-xl"
              style={{maxHeight:"calc(100dvh - 120px)",maxWidth:"100vw"}} />
          : <video ref={videoRef} src={item.url} poster={item.poster} muted={muted} loop playsInline
              className="max-w-full max-h-full object-contain rounded-xl"
              style={{maxHeight:"calc(100dvh - 160px)",maxWidth:"100vw"}}
              onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)}
              onLoadedMetadata={e=>setDuration(e.currentTarget.duration||0)}
              onTimeUpdate={e=>setCurrent(e.currentTarget.currentTime)} />}
      </div>
      {/* Arrows */}
      {idx>0 && <button onClick={()=>setIdx(i=>i-1)} className={`${btnCls("prev")} absolute left-3 top-1/2 -translate-y-1/2`}><ChevronLeft size={22}/></button>}
      {idx<media.length-1 && <button onClick={()=>setIdx(i=>i+1)} className={`${btnCls("next")} absolute right-3 top-1/2 -translate-y-1/2`}><ChevronRight size={22}/></button>}
      {/* Dots */}
      {media.length>1 && (
        <div className="absolute left-1/2 -translate-x-1/2 flex gap-2" style={{bottom:item.type==="video"?130:24}}>
          {media.map((_,i)=><button key={i} onClick={()=>setIdx(i)} className={`rounded-full transition-all ${i===idx?"bg-white w-5 h-1.5":"bg-white/40 w-1.5 h-1.5"}`}/>)}
        </div>
      )}
      {/* Video controls */}
      {item.type==="video" && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-8 pt-12">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-white text-[11px] font-mono shrink-0 w-10 text-right">{Tfmt(current)}</span>
            <input type="range" min={0} max={duration||100} value={current} onChange={seek}
              className="flex-1 h-1.5 rounded-full cursor-pointer appearance-none"
              style={{background:`linear-gradient(to right,#3b82f6 ${(current/(duration||1))*100}%,rgba(255,255,255,.2) 0%)`}} />
            <span className="text-white text-[11px] font-mono shrink-0 w-10">{Tfmt(duration)}</span>
          </div>
          <div className="flex items-center justify-between">
            <button onClick={togglePlay} className={btnCls("play")}>{playing?<Pause size={18} fill="white"/>:<Play size={18} fill="white" className="ml-0.5"/>}</button>
            <button onClick={toggleMute} className={btnCls("mute")}>{muted?<VolumeX size={16}/>:<Volume2 size={16}/>}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   RICH TEXT — hashtags, mentions, URLs all clickable
══════════════════════════════════════════════════════════════ */
function RichText({ text, isLoggedIn, onMention, onHashtag }: {
  text: string;
  isLoggedIn: boolean;
  onMention: (username: string) => void;
  onHashtag:  (tag: string) => void;
}) {
  const TOKEN_RE = /(https?:\/\/[^\s]+)|(#[\w\u0900-\u097F\u0980-\u09FF]+)|(@\w+)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (m[1]) {
      // URL
      parts.push(
        <a key={m.index} href={token} target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-blue-500 hover:underline break-all">
          <Link2 size={11} className="inline mr-0.5 -mt-0.5" />{token}
        </a>
      );
    } else if (m[2]) {
      // hashtag
      parts.push(
        <span key={m.index} onClick={e => { e.stopPropagation(); onHashtag(token); }}
          className="text-blue-500 hover:underline cursor-pointer font-medium">{token}</span>
      );
    } else if (m[3]) {
      // mention
      parts.push(
        <span key={m.index} onClick={e => { e.stopPropagation(); onMention(token); }}
          className="text-blue-500 hover:underline cursor-pointer font-medium">{token}</span>
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/* ══════════════════════════════════════════════════════════════
   MAIN POSTCARD
══════════════════════════════════════════════════════════════ */
export function PostCard({
  post,
  isLoggedIn   = false,
  isOwn        = false,
  isFollowing  = false,
  currentUserId,
  onDelete,
  showPin      = false,
  societyHandle,
  societyName,
}: PostCardProps) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();
  const uid       = currentUserId ?? user?.id;
  const quoteUrl  = `/quote/${post.id}`;

  /* ── Pop-out animation ── */
  const [popping, setPopping] = useState(false);
  const [removed, setRemoved] = useState(false);
  const startPopOut = useCallback((cb?: () => void) => {
    setPopping(true);
    setTimeout(() => { setRemoved(true); cb?.(); }, 360);
  }, []);

  /* ── Toast ── */
  const [toast, setToast] = useState<string|null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg); setTimeout(()=>setToast(null), 2000);
  }, []);

  /* ── Interaction state ──
     Double-count fix: use a pending ref to block rapid-fire clicks.
     The ref is synchronous — state updates are async and cause stale closures.
  ── */
  const [praised,     setPraised]     = useState<boolean>(post.isLiked    ?? false);
  const [forwarded,   setForwarded]   = useState<boolean>(post.isReposted ?? false);
  const [bookmarked,  setBookmarked]  = useState<boolean>(false);
  const [following,   setFollowing]   = useState<boolean>(isFollowing);
  const [praiseCount, setPraiseCount] = useState<number>(post.likes   ?? post.likes_count   ?? 0);
  const [fwdCount,    setFwdCount]    = useState<number>(post.reposts ?? post.forwards_count ?? 0);
  const [viewCount,   setViewCount]   = useState<number>(post.views_count ?? 0);
  const [isPinned,    setIsPinned]    = useState<boolean>(post.is_pinned ?? false);
  const [followAnim,  setFollowAnim]  = useState(false);
  const [expanded,    setExpanded]    = useState(false);
  const [inlineReply, setInlineReply] = useState(false);
  const [replyText,   setReplyText]   = useState("");
  const [replying,    setReplying]    = useState(false);

  /* Pending refs — prevents double-count from rapid clicks */
  const praisingRef   = useRef(false);
  const forwardingRef = useRef(false);
  const bookmarkingRef = useRef(false);
  const followingRef   = useRef(false);
  const viewedRef      = useRef(false);

  useEffect(() => { setFollowing(isFollowing); }, [isFollowing]);

  /* Load bookmark */
  useEffect(() => {
    if (!uid||!post.id) return;
    let gone = false;
    supabase.from("bookmarks").select("user_id").eq("user_id",uid).eq("post_id",post.id).maybeSingle()
      .then(({data}) => { if(!gone&&data) setBookmarked(true); });
    return () => { gone=true; };
  }, [uid, post.id]);

  /* View increment via IntersectionObserver — fires once per mount */
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!post.id || viewedRef.current) return;
    const timer = { id: 0 as any };
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        timer.id = setTimeout(() => {
          if (viewedRef.current) return;
          viewedRef.current = true;
          setViewCount(v => v+1);
          supabase.from("posts").update({ views_count: (post.views_count||0)+1 }).eq("id", post.id).then(()=>{});
          obs.disconnect();
        }, 1500);
      } else {
        clearTimeout(timer.id);
      }
    }, { threshold: 0.6 });
    if (cardRef.current) obs.observe(cardRef.current);
    return () => { obs.disconnect(); clearTimeout(timer.id); };
  }, [post.id, post.views_count]);

  /* ── Three-dot menu ── */
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const dotRef = useRef<HTMLButtonElement>(null);

  const openMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (menuOpen) { setMenuOpen(false); return; }
    const r = dotRef.current?.getBoundingClientRect();
    if (!r) return;
    const W    = 215;
    const left = Math.max(8, Math.min(r.right-W, window.innerWidth-W-8));
    const top  = Math.min(r.bottom+6, window.innerHeight-320);
    setMenuStyle({ position:"fixed", left, top, width:W, zIndex:9999 });
    setMenuOpen(true);
  }, [menuOpen]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  /* ── Media ── */
  const [mediaIdx,    setMediaIdx]   = useState(0);
  const [videoPlay,   setVideoPlay]  = useState(false);
  const [videoMuted,  setVideoMuted] = useState(getMuted);
  const [videoVol,    setVideoVol]   = useState(getVolume);
  const [vidCurrent,  setVidCurr]    = useState(0);
  const [vidDuration, setVidDur]     = useState(0);
  const [showVolBar,  setShowVol]    = useState(false);
  const [lazyAR,      setLazyAR]     = useState<Record<number,number>>({});
  const [activeBtn,   setActiveBtn]  = useState<string|null>(null);
  const [fullscreen,  setFullscreen] = useState(false);
  const [swipeSX,     setSwipeSX]    = useState(0);
  const [swipeSY,     setSwipeSY]    = useState(0);
  const [lockedH,     setLockedH]    = useState<number|null>(null);

  const videoRefs = useRef<(HTMLVideoElement|null)[]>([]);
  const outerRef  = useRef<HTMLDivElement>(null);
  const [cardW,   setCardW] = useState(0);

  /* Double-tap praise */
  const lastTapRef = useRef(0);
  const handleDoubleTap = (e: React.MouseEvent) => {
    if (!isLoggedIn) return;
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      if (!praised) doPraise(e);
    }
    lastTapRef.current = now;
  };

  useEffect(() => {
    const el = outerRef.current; if (!el) return;
    const ro = new ResizeObserver(es => setCardW(es[0]?.contentRect.width ?? 0));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  useEffect(() => {
    videoRefs.current.forEach((v,i) => { if(v&&i!==mediaIdx) v.pause(); });
    setVideoPlay(false); setVidCurr(0); setVidDur(0);
  }, [mediaIdx]);

  useEffect(() => {
    const v = videoRefs.current[mediaIdx]; if(!v) return;
    v.muted=videoMuted; v.volume=videoVol;
  }, [videoMuted, videoVol, mediaIdx]);

  const allMedia: MediaItem[] = useMemo(() => {
    if (post.mediaItems?.length>0) return post.mediaItems as MediaItem[];
    const items: MediaItem[] = [];
    if (post.images?.length>0) post.images.forEach((u:string)=>items.push({type:"image",url:u}));
    else if (post.image) items.push({type:"image",url:post.image});
    if (post.video) items.push({type:"video",url:post.video,poster:post.videoPoster});
    return items;
  }, [post]);

  const computedH = useMemo(() => {
    const w = cardW||360;
    const item = allMedia[0]; if (!item) return 0;
    let ar: number|null = null;
    if (item.width&&item.height&&item.width>0&&item.height>0) ar=item.width/item.height;
    else if (lazyAR[0]) ar=lazyAR[0];
    if (ar!==null) {
      const h = w/ar;
      if (ar<0.75) return Math.min(h,500);
      if (ar>1.8)  return Math.min(h,280);
      if (ar>1.2)  return Math.min(h,340);
      return Math.min(h,420);
    }
    return item.type==="video"?280:320;
  }, [cardW,allMedia,lazyAR]);

  useEffect(() => { if (lockedH===null&&computedH>0) setLockedH(computedH); }, [computedH,lockedH]);
  const mediaHeight = lockedH??computedH;

  const onImgLoad  = (e: React.SyntheticEvent<HTMLImageElement>, i: number) => {
    const {naturalWidth:w,naturalHeight:h} = e.currentTarget;
    if (w&&h&&!allMedia[i]?.width) setLazyAR(p=>({...p,[i]:w/h}));
  };
  const onVideoMeta = (e: React.SyntheticEvent<HTMLVideoElement>, i: number) => {
    const {videoWidth:w,videoHeight:h} = e.currentTarget;
    if (w&&h&&!allMedia[i]?.width) setLazyAR(p=>({...p,[i]:w/h}));
    if (i===mediaIdx) setVidDur(e.currentTarget.duration||0);
  };

  const noCtx  = (e: React.SyntheticEvent) => e.preventDefault();
  const flashB = (k: string) => { setActiveBtn(k); setTimeout(()=>setActiveBtn(null),280); };
  const vBtnCls = (k: string) =>
    `w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 ${
      activeBtn===k?"bg-blue-600 text-white shadow-md shadow-blue-600/40":"bg-black/55 text-white hover:bg-blue-600"
    }`;

  const vidTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation(); flashB("play");
    const v=videoRefs.current[mediaIdx]; if(!v) return;
    videoPlay?v.pause():v.play();
  };
  const vidToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation(); flashB("mute");
    const next=!videoMuted; setVideoMuted(next); saveMuted(next); setShowVol(s=>!s);
    const v=videoRefs.current[mediaIdx]; if(v) v.muted=next;
  };
  const vidChangeVol = (val: number) => {
    setVideoVol(val); saveVolume(val);
    const v=videoRefs.current[mediaIdx];
    if(v){v.volume=val;const m=val===0;setVideoMuted(m);saveMuted(m);}
  };
  const vidSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const v=videoRefs.current[mediaIdx]; if(!v) return;
    const t=Number(e.target.value); v.currentTime=t; setVidCurr(t);
  };
  const openFullscreen = (e: React.MouseEvent, i: number) => {
    e.stopPropagation(); flashB("full"); setMediaIdx(i); setFullscreen(true);
  };

  /* ── Auth guard ── */
  const guard = useCallback((fn: () => void) => {
    if (!isLoggedIn) { navigate("/login"); return; }
    fn();
  }, [isLoggedIn, navigate]);

  /* ── Navigation ── */
  const goProfile = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn) { navigate("/login"); return; }
    if (post.is_anon) return;
    if (isOwn) { navigate("/profile"); return; }
    // Use username for SEO canonical URL
    const username = post.user?.username?.replace(/^@/, "");
    if (username) navigate(`/profile/${username}`);
    else if (post.user?.id) navigate(`/user/${post.user.id}`);
  }, [isLoggedIn, isOwn, post.is_anon, post.user, navigate]);

  const goMention = useCallback(async (username: string) => {
    if (!isLoggedIn) { navigate("/login"); return; }
    const u = username.replace(/^@/,"").toLowerCase();
    const { data } = await supabase.from("profiles").select("username").ilike("username",u).maybeSingle();
    if (data?.username) navigate(`/profile/${data.username}`);
    else showToast("User not found");
  }, [isLoggedIn, navigate, showToast]);

  const goHashtag = useCallback((tag: string) => {
    const q = encodeURIComponent(tag);
    navigate(isLoggedIn ? `/feed/search?q=${q}` : `/search?q=${q}`);
  }, [isLoggedIn, navigate]);

  /* ── Actions ── */
  const doPraise = (e: React.MouseEvent) => {
    e.stopPropagation();
    guard(() => {
      /* Double-count fix: block if already in flight */
      if (praisingRef.current) return;
      praisingRef.current = true;
      const was = praised;
      setPraised(!was);
      setPraiseCount(c => was ? Math.max(0,c-1) : c+1);
      if (!uid) { praisingRef.current=false; return; }
      togglePraise(post.id, uid, was)
        .catch(() => { setPraised(was); setPraiseCount(c => was?c+1:Math.max(0,c-1)); })
        .finally(() => { praisingRef.current=false; });
    });
  };

  const doForward = (e: React.MouseEvent) => {
    e.stopPropagation();
    guard(() => {
      if (forwardingRef.current) return;
      forwardingRef.current = true;
      const was = forwarded;
      setForwarded(!was);
      setFwdCount(c => was ? Math.max(0,c-1) : c+1);
      if (!uid) { forwardingRef.current=false; return; }
      toggleForward(post.id, uid, was)
        .catch(() => { setForwarded(was); setFwdCount(c => was?c+1:Math.max(0,c-1)); })
        .finally(() => { forwardingRef.current=false; });
    });
  };

  const doBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    guard(() => {
      if (bookmarkingRef.current) return;
      bookmarkingRef.current = true;
      const was = bookmarked; setBookmarked(!was);
      if (!uid) { bookmarkingRef.current=false; return; }
      toggleBookmark(post.id, uid, was)
        .catch(() => setBookmarked(was))
        .finally(() => { bookmarkingRef.current=false; });
    });
  };

  const doFollow = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isLoggedIn) { navigate("/login"); return; }
    if (!uid||!post.user?.id||followingRef.current) return;
    followingRef.current = true;
    const was = following; setFollowing(!was);
    if (!was) {
      setFollowAnim(true); setTimeout(()=>setFollowAnim(false),1800);
      const {error} = await supabase.from("follows").insert({follower_id:uid,following_id:post.user.id});
      if (error) setFollowing(false);
    } else {
      await supabase.from("follows").delete().eq("follower_id",uid).eq("following_id",post.user.id);
    }
    followingRef.current = false;
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
    if (!uid||!post.user?.id) return;
    startPopOut(() => {
      onDelete?.(post.id);
      if (location.pathname.startsWith("/quote/")) navigate(-1);
    });
    try { await blockUser(uid, post.user.id); } catch {}
  };

  const doRequote = () => { closeMenu(); guard(() => navigate(`/create-post?requote=${post.id}`)); };

  const doPin = async () => {
    closeMenu();
    if (!uid) return;
    const next = !isPinned;
    setIsPinned(next);
    await supabase.from("posts").update({is_pinned:next}).eq("id",post.id).eq("user_id",uid);
    showToast(next ? "Pinned to profile" : "Unpinned");
  };

  const doShare = () => {
    closeMenu();
    const url = `${window.location.origin}/quote/${post.id}`;
    if (navigator.share) navigator.share({url}).catch(()=>{});
    else { navigator.clipboard?.writeText(url); showToast("Link copied!"); }
  };

  const doCopyLink = () => {
    closeMenu();
    const url = `${window.location.origin}/quote/${post.id}`;
    navigator.clipboard?.writeText(url);
    showToast("Link copied!");
  };

  const doReport = () => { closeMenu(); navigate(`/report/${post.id}`); };
  const goQuote  = (e: React.MouseEvent) => { e.stopPropagation(); navigate(quoteUrl); };

  /* Inline quick reply submit */
  const submitReply = async () => {
    if (!replyText.trim()||!uid||replying) return;
    setReplying(true);
    await supabase.from("thoughts").insert({ post_id:post.id, user_id:uid, body:replyText.trim() });
    setReplyText(""); setInlineReply(false); setReplying(false);
    showToast("Replied!");
  };

  /* Display strings */
  const displayName  = post.is_anon ? "Anonymous" : (post.user?.name    || "User");
  const displayUname = post.is_anon ? ""          : (post.user?.username || "");
  const timeStr      = post.timestamp || "";
  const fullText     = post.content || post.body || "";
  const TRUNCATE     = 220;
  const isLong       = fullText.length > TRUNCATE;
  const shownText    = isLong && !expanded ? fullText.slice(0,TRUNCATE)+"…" : fullText;

  /* Hashtag pills from DB array */
  const hashtagPills: string[] = (post.hashtags||[]).slice(0,6);

  if (removed) return null;

  const popStyle: React.CSSProperties = popping ? {
    animation: "pcPopOut 360ms cubic-bezier(.4,0,.6,1) forwards",
    overflow:"hidden", pointerEvents:"none",
  } : {};

  /* ════════════════════════ SHARED PIECES ════════════════════════ */

  const QuoteText = fullText ? (
    <div onClick={handleDoubleTap}>
      <p onClick={goQuote}
        className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed break-words cursor-pointer mt-0.5">
        <RichText text={shownText} isLoggedIn={isLoggedIn} onMention={goMention} onHashtag={goHashtag} />
      </p>
      {isLong && (
        <button onClick={e=>{e.stopPropagation();setExpanded(x=>!x);}}
          className="text-xs text-blue-500 font-semibold mt-0.5 hover:underline">
          {expanded?"Show less":"Read more"}
        </button>
      )}
      {/* Double-tap hint — shown only once */}
      {isLoggedIn && !praised && (
        <span className="sr-only">Double-tap to praise</span>
      )}
    </div>
  ) : null;

  /* City badge */
  const CityBadge = post.city ? (
    <div className="flex items-center gap-1 mt-1.5">
      <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-2 py-0.5 rounded-full">
        <MapPin size={9}/> {post.city}
      </span>
    </div>
  ) : null;

  /* Society badge */
  const SocietyBadge = societyHandle && societyName ? (
    <button onClick={e=>{e.stopPropagation();navigate(`/society/${societyHandle}`);}}
      className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 px-2 py-0.5 rounded-full mt-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-colors">
      <Building2 size={9}/> {societyName}
    </button>
  ) : null;

  /* Hashtag pills row */
  const HashtagPills = hashtagPills.length > 0 ? (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {hashtagPills.map(tag => (
        <button key={tag} onClick={e=>{e.stopPropagation();goHashtag(`#${tag}`);}}
          className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-950/70 transition-colors">
          <Hash size={9}/>{tag.length>16?tag.slice(0,15)+"…":tag}
        </button>
      ))}
    </div>
  ) : null;

  /* Requote embed */
  const RequoteEmbed = post.is_forward ? (
    post.originalPost ? (
      <div onClick={e=>{e.stopPropagation();navigate(`/quote/${post.originalPost.id}`);}}
        className="mt-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        {post.forward_comment && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 italic">"{post.forward_comment}"</p>
        )}
        <div className="flex items-center gap-2 mb-1">
          <Avatar src={post.originalPost.user?.avatar} name={post.originalPost.user?.name||"User"} size={18}/>
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{post.originalPost.user?.name}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">{post.originalPost.user?.username}</span>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3">{post.originalPost.content||post.originalPost.body}</p>
      </div>
    ) : (
      /* Original post was deleted */
      <div className="mt-2 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-3 flex items-center gap-2 text-gray-400 dark:text-gray-600">
        <AlertCircle size={14}/>
        <span className="text-xs">Original post was deleted</span>
      </div>
    )
  ) : null;

  /* Media carousel */
  const MediaCarousel = allMedia.length > 0 ? (
    <div ref={outerRef}
      className="mt-2 rounded-2xl overflow-hidden relative select-none bg-black"
      style={{height:mediaHeight>0?`${mediaHeight}px`:undefined,minHeight:"120px"}}
      onTouchStart={e=>{setSwipeSX(e.targetTouches[0].clientX);setSwipeSY(e.targetTouches[0].clientY);}}
      onTouchEnd={e=>{
        const dx=swipeSX-e.changedTouches[0].clientX;
        const dy=swipeSY-e.changedTouches[0].clientY;
        if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>40){
          if(dx>0&&mediaIdx<allMedia.length-1)setMediaIdx(p=>p+1);
          else if(dx<0&&mediaIdx>0)setMediaIdx(p=>p-1);
        }
      }}>
      {allMedia.map((item,i)=>(
        <div key={i} className="absolute inset-0 w-full h-full"
          style={{transform:`translateX(${(i-mediaIdx)*100}%)`,transition:"transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)",willChange:"transform"}}>
          {item.type==="image" ? (
            <div className="relative w-full h-full overflow-hidden" onContextMenu={noCtx}>
              <img src={item.url} aria-hidden draggable={false}
                className="absolute inset-0 w-full h-full object-cover scale-110 pointer-events-none"
                style={{filter:"blur(20px) brightness(.35) saturate(1.6)"}} onContextMenu={noCtx}/>
              <img src={item.url} alt="" draggable={false}
                className="relative z-10 w-full h-full object-contain"
                onLoad={e=>onImgLoad(e,i)} onContextMenu={noCtx}/>
              <button onClick={e=>openFullscreen(e,i)}
                className="absolute top-2 right-2 z-20 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-blue-600 transition-colors active:scale-90">
                <Maximize2 size={13}/>
              </button>
            </div>
          ) : (
            <div className="relative w-full h-full overflow-hidden bg-black" onContextMenu={noCtx}>
              {item.poster && <img src={item.poster} aria-hidden draggable={false}
                className="absolute inset-0 w-full h-full object-cover scale-110"
                style={{filter:"blur(18px) brightness(.3) saturate(1.6)"}} onContextMenu={noCtx}/>}
              <video
                ref={el=>{videoRefs.current[i]=el;if(el){(el as any).disableRemotePlayback=true;el.muted=videoMuted;el.volume=videoVol;}}}
                src={item.url} poster={item.poster} muted={videoMuted} loop playsInline
                className="relative z-10 w-full h-full object-contain"
                onLoadedMetadata={e=>onVideoMeta(e,i)}
                onPlay={()=>i===mediaIdx&&setVideoPlay(true)}
                onPause={()=>i===mediaIdx&&setVideoPlay(false)}
                onTimeUpdate={e=>{if(i===mediaIdx)setVidCurr(e.currentTarget.currentTime);}}
                onContextMenu={noCtx}/>
              {i===mediaIdx && (
                <div className="absolute inset-0 z-20 flex flex-col justify-between p-2.5 pointer-events-none">
                  <div className="flex items-center justify-between pointer-events-auto">
                    <button onClick={vidTogglePlay} className={vBtnCls("play")}>
                      {videoPlay?<Pause size={14} fill="white"/>:<Play size={14} fill="white" className="ml-0.5"/>}
                    </button>
                    <div className="flex items-center gap-1.5">
                      {showVolBar && (
                        <div className="flex items-center gap-1.5 bg-black/60 rounded-full px-2.5 py-1">
                          <input type="range" min={0} max={1} step={0.05} value={videoVol}
                            onChange={e=>vidChangeVol(parseFloat(e.target.value))}
                            onClick={e=>e.stopPropagation()}
                            className="w-16 h-1 rounded-full appearance-none cursor-pointer"
                            style={{background:`linear-gradient(to right,#3b82f6 ${videoVol*100}%,rgba(255,255,255,.25) 0%)`}}/>
                          <span className="text-white text-[9px] tabular-nums w-5">{Math.round(videoVol*100)}%</span>
                        </div>
                      )}
                      <button onClick={vidToggleMute} className={vBtnCls("mute")}>{videoMuted?<VolumeX size={13}/>:<Volume2 size={13}/>}</button>
                      <button onClick={e=>openFullscreen(e,i)} className={vBtnCls("full")}><Maximize2 size={13}/></button>
                    </div>
                  </div>
                  {!videoPlay && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-14 h-14 rounded-full bg-black/40 flex items-center justify-center">
                        <Play size={26} fill="white" className="text-white ml-1"/>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pointer-events-auto">
                    <span className="text-white text-[10px] font-mono shrink-0">{Tfmt(vidCurrent)}</span>
                    <input type="range" min={0} max={vidDuration||100} value={vidCurrent}
                      onChange={vidSeek} onClick={e=>e.stopPropagation()}
                      className="flex-1 h-1 appearance-none rounded-full cursor-pointer"
                      style={{background:`linear-gradient(to right,#3b82f6 ${(vidCurrent/(vidDuration||1))*100}%,rgba(255,255,255,.25) 0%)`}}/>
                    <span className="text-white text-[10px] font-mono shrink-0">{Tfmt(vidDuration)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      {allMedia.length>1&&mediaIdx>0&&(
        <button onClick={e=>{e.stopPropagation();setMediaIdx(p=>p-1);}}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-blue-600 active:bg-blue-700 z-30 transition-colors">
          <ChevronLeft size={16}/>
        </button>
      )}
      {allMedia.length>1&&mediaIdx<allMedia.length-1&&(
        <button onClick={e=>{e.stopPropagation();setMediaIdx(p=>p+1);}}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-blue-600 active:bg-blue-700 z-30 transition-colors">
          <ChevronRight size={16}/>
        </button>
      )}
      {allMedia.length>1&&(
        <>
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-1.5 z-30">
            {allMedia.map((_,i)=>(
              <button key={i} onClick={e=>{e.stopPropagation();setMediaIdx(i);}}
                className={`rounded-full transition-all ${i===mediaIdx?"bg-white w-4 h-1.5":"bg-white/50 w-1.5 h-1.5"}`}/>
            ))}
          </div>
          <div className="absolute top-2 left-2 z-30">
            <span className="bg-black/40 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">{mediaIdx+1}/{allMedia.length}</span>
          </div>
        </>
      )}
    </div>
  ) : null;

  /* ── ACTION BAR — different for guest vs logged-in ── */
  const ActionBar = (
    <div className="flex items-center mt-2.5 gap-1">
      {/* Thoughts */}
      {!post.comments_off ? (
        <button onClick={e=>{e.stopPropagation();if(!isLoggedIn){navigate("/login");return;}setInlineReply(r=>!r);}}
          className={`flex items-center gap-1.5 transition-colors mr-4 ${
            inlineReply?"text-blue-500":"text-gray-400 dark:text-gray-500 hover:text-blue-500"
          }`}>
          <MessageCircle size={16}/>
          <span className="text-xs font-medium tabular-nums">{N(post.thoughts??post.thoughts_count??0)}</span>
        </button>
      ) : (
        <div className="flex items-center gap-1 text-gray-300 dark:text-gray-600 mr-4" title="Comments off">
          <MessageSquare size={15}/>
          <span className="text-[10px] text-gray-300 dark:text-gray-700">Off</span>
        </div>
      )}

      {/* Forward — silent only (Option B) */}
      <button onClick={isLoggedIn ? doForward : ()=>navigate("/login")}
        className={`flex items-center gap-1.5 transition-colors mr-4 ${
          forwarded?"text-green-500":"text-gray-400 dark:text-gray-500 hover:text-green-500"
        }`}>
        <RefreshCw size={16} className={forwarded?"animate-none":""}/>
        <span className="text-xs font-medium tabular-nums">{N(fwdCount)}</span>
      </button>

      {/* Praise */}
      <button onClick={isLoggedIn ? doPraise : ()=>navigate("/login")}
        className={`flex items-center gap-1.5 transition-colors ${
          praised?"text-orange-500":"text-gray-400 dark:text-gray-500 hover:text-orange-500"
        }`}>
        <ThumbsUp size={16} className={praised?"fill-orange-500 scale-110":""}
          style={{transition:"transform 0.15s"}}/>
        <span className="text-xs font-medium tabular-nums">{N(praiseCount)}</span>
      </button>

      <div className="flex-1"/>

      {/* Views */}
      <div className="flex items-center gap-1 text-gray-300 dark:text-gray-700 mr-2">
        <Eye size={13}/>
        <span className="text-[10px] tabular-nums">{N(viewCount)}</span>
      </div>

      {/* Bookmark — logged-in only */}
      {isLoggedIn && (
        <button onClick={doBookmark}
          className={`transition-colors ${
            bookmarked?"text-blue-600 dark:text-blue-400":"text-gray-400 dark:text-gray-500 hover:text-blue-500"
          }`}>
          <Bookmark size={16} className={bookmarked?"fill-blue-600 dark:fill-blue-400":""}/>
        </button>
      )}
    </div>
  );

  /* ── INLINE REPLY ── */
  const InlineReply = inlineReply && isLoggedIn ? (
    <div className="mt-2 flex items-center gap-2" onClick={e=>e.stopPropagation()}>
      <input
        value={replyText}
        onChange={e=>setReplyText(e.target.value.slice(0,280))}
        onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submitReply();}}}
        placeholder="Write a thought…"
        autoFocus
        className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 text-gray-900 dark:text-white placeholder-gray-400"
      />
      <button onClick={submitReply} disabled={!replyText.trim()||replying}
        className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center disabled:opacity-40 hover:bg-blue-700 transition-colors shrink-0">
        <Share2 size={13} className="text-white"/>
      </button>
    </div>
  ) : null;

  /* ════════════════════════ CARD WRAPPER ════════════════════════ */
  const renderCard = (headerControls: React.ReactNode) => (
    <>
      <style>{`
        @keyframes pcPopOut {
          0%  {opacity:1;transform:scale(1);max-height:900px}
          30% {opacity:.5;transform:scale(1.015)}
          100%{opacity:0;transform:scale(.88);max-height:0;padding:0;border:none}
        }
        @keyframes followBadge {
          0%  {opacity:0;transform:translateY(6px) scale(.85)}
          20% {opacity:1;transform:translateY(0) scale(1.05)}
          65% {opacity:1}
          100%{opacity:0;transform:translateY(-10px) scale(.9)}
        }
        @keyframes praisePopIn {
          0%  {transform:scale(1)}
          40% {transform:scale(1.4)}
          70% {transform:scale(.9)}
          100%{transform:scale(1)}
        }
      `}</style>

      <div ref={cardRef}
        className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 relative"
        style={popStyle}>

        {/* Toast */}
        {toast && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none bg-gray-900 dark:bg-gray-700 text-white text-[12px] font-semibold px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap">
            {toast}
          </div>
        )}

        {/* Follow animation */}
        {followAnim && (
          <div className="absolute top-3 right-12 z-20 flex items-center gap-1 bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg pointer-events-none"
            style={{animation:"followBadge 1.8s ease-out forwards"}}>
            <Check size={11}/> Following!
          </div>
        )}

        {/* Pin label — ONLY on profile page (showPin=true), not feed */}
        {isPinned && isOwn && showPin && (
          <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-0">
            <Pin size={11} className="text-blue-500"/>
            <span className="text-[11px] text-blue-500 font-semibold tracking-wide">Pinned Quote</span>
          </div>
        )}

        {/* MAIN ROW */}
        <div className="flex gap-3 px-4 pt-3 pb-3">

          {/* Avatar */}
          <div className="shrink-0 pt-0.5">
            {post.is_anon ? (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center cursor-default">
                <Shield size={18} className="text-white"/>
              </div>
            ) : (
              <Avatar src={post.user?.avatar||post.user?.avatar_url} name={displayName} size={40}
                onClick={post.is_anon ? undefined : goProfile}/>
            )}
          </div>

          {/* Content column */}
          <div className="flex-1 min-w-0">

            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <button onClick={post.is_anon ? undefined : goProfile}
                className={`text-left min-w-0 flex-1 group ${post.is_anon?"cursor-default":""}`}>
                <div className="flex items-center gap-1 flex-wrap leading-tight">
                  <span className={`font-bold text-gray-900 dark:text-white text-sm truncate max-w-[160px] ${!post.is_anon?"group-hover:underline":""}`}>
                    {displayName}
                  </span>
                  {/* Verified badge */}
                  {post.user?.isVerified && !post.is_anon && (
                    <span className="inline-flex items-center justify-center w-[15px] h-[15px] bg-blue-500 rounded-full shrink-0">
                      <Check size={9} className="text-white" strokeWidth={3}/>
                    </span>
                  )}
                  {/* Org badge — building icon, not check */}
                  {post.user?.is_org && !post.is_anon && (
                    <span className="inline-flex items-center justify-center w-[15px] h-[15px] bg-purple-500 rounded-full shrink-0">
                      <Building2 size={8} className="text-white"/>
                    </span>
                  )}
                  {/* Anon tag */}
                  {post.is_anon && (
                    <span className="text-[10px] bg-gray-700 dark:bg-gray-600 text-gray-300 px-1.5 py-0.5 rounded-full font-semibold shrink-0">anon</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">
                  {post.is_anon ? timeStr : `${displayUname} · ${timeStr}`}
                </div>
              </button>
              {headerControls}
            </div>

            {/* Text */}
            {QuoteText}

            {/* Metadata badges row */}
            <div className="flex flex-wrap gap-1.5 mt-1">
              {CityBadge}
              {SocietyBadge}
            </div>

            {/* Hashtag pills */}
            {HashtagPills}

            {/* Requote embed */}
            {RequoteEmbed}

            {/* Poll */}
            <PollCard postId={post.id} isLoggedIn={isLoggedIn} currentUserId={uid}/>

            {/* Media */}
            {MediaCarousel}

            {/* Comments off indicator (only when comments_off and not own post) */}
            {post.comments_off && !isOwn && (
              <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-400 dark:text-gray-600">
                <MessageSquare size={10}/> Comments are turned off
              </div>
            )}

            {/* Action bar */}
            {ActionBar}

            {/* Inline reply */}
            {InlineReply}
          </div>
        </div>
      </div>

      {/* THREE-DOT MENU */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={closeMenu} onTouchStart={e=>{e.preventDefault();closeMenu();}}/>
          <div className="z-[9999] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden py-1.5"
            style={menuStyle} onClick={e=>e.stopPropagation()}>
            {isOwn ? (
              /* OWN POST MENU */
              <>
                <MRow icon={<RefreshCw size={15}/>} label="Requote" onClick={doRequote}/>
                <MRow icon={<Pin size={15}/>} label={isPinned?"Unpin from profile":"Pin to profile"} onClick={doPin}/>
                <MRow icon={<Link2 size={15}/>} label="Copy link" onClick={doCopyLink}/>
                <MRow icon={<Share2 size={15}/>} label="Share" onClick={doShare}/>
                <MDivider/>
                <MRow icon={<Trash2 size={15}/>} label="Delete Quote" onClick={doDelete} danger/>
                <MDivider/>
                <MRow icon={<X size={15}/>} label="Cancel" onClick={closeMenu} muted/>
              </>
            ) : isLoggedIn ? (
              /* OTHERS' POST MENU */
              <>
                <MRow icon={<RefreshCw size={15}/>} label="Requote" onClick={doRequote}/>
                {!post.is_anon && (
                  <MRow
                    icon={following?<Check size={15}/>:<UserPlus size={15}/>}
                    label={following?`Unfollow ${displayUname}`:`Follow ${displayUname}`}
                    onClick={()=>{closeMenu();doFollow();}}/>
                )}
                <MRow icon={<Link2 size={15}/>} label="Copy link" onClick={doCopyLink}/>
                <MRow icon={<Share2 size={15}/>} label="Share" onClick={doShare}/>
                <MDivider/>
                <MRow icon={<Flag size={15}/>} label="Report" onClick={doReport} danger/>
                {!post.is_anon && (
                  <MRow icon={<Ban size={15}/>} label={`Block ${displayUname}`} onClick={doBlock} danger/>
                )}
                <MDivider/>
                <MRow icon={<X size={15}/>} label="Cancel" onClick={closeMenu} muted/>
              </>
            ) : (
              /* GUEST MENU — minimal */
              <>
                <MRow icon={<Link2 size={15}/>} label="Copy link" onClick={doCopyLink}/>
                <MRow icon={<Share2 size={15}/>} label="Share" onClick={doShare}/>
                <MDivider/>
                <MRow icon={<X size={15}/>} label="Cancel" onClick={closeMenu} muted/>
              </>
            )}
          </div>
        </>
      )}

      {/* Fullscreen viewer */}
      {fullscreen && allMedia.length>0 && (
        <FullscreenViewer media={allMedia} startIdx={mediaIdx} onClose={()=>setFullscreen(false)}/>
      )}
    </>
  );

  /* ══════════════════════════════════════
     GUEST POST — simplified header, no follow button
  ══════════════════════════════════════ */
  if (!isLoggedIn) {
    return renderCard(
      <button ref={dotRef} onClick={openMenu}
        className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0 mt-0.5">
        <MoreVertical size={17}/>
      </button>
    );
  }

  /* ══════════════════════════════════════
     OWN POST — no follow button
  ══════════════════════════════════════ */
  if (isOwn) {
    return renderCard(
      <button ref={dotRef} onClick={openMenu}
        className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0 mt-0.5">
        <MoreVertical size={17}/>
      </button>
    );
  }

  /* ══════════════════════════════════════
     OTHERS' POST — Follow button + ⋮
  ══════════════════════════════════════ */
  return renderCard(
    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
      {!post.is_anon && (
        <button onClick={e=>doFollow(e)}
          className={[
            "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all active:scale-95",
            following
              ? "border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50"
              : "border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50",
          ].join(" ")}>
          {following
            ? <><Check size={11}/><span className="ml-0.5">Following</span></>
            : <><UserPlus size={11}/><span className="ml-0.5">Follow</span></>
          }
        </button>
      )}
      <button ref={dotRef} onClick={openMenu}
        className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <MoreVertical size={17}/>
      </button>
    </div>
  );
}

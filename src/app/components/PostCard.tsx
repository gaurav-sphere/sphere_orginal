import React, { useState, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  MessageCircle, Repeat2, Heart, MoreHorizontal, Bookmark,
  Link2, X, Shield, Flag, UserMinus, Share2, Play, Volume2,
  VolumeX, ChevronLeft, ChevronRight, Check,
} from "lucide-react";
import { LoginGateSheet } from "./LoginGateSheet";

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface MediaItem { type: "image" | "video"; url: string; poster?: string; aspectRatio?: number }
export interface Post {
  id: string;
  content: string;
  timestamp: string;
  user: {
    id: string; name: string; username: string; anonUsername?: string;
    avatar: string; isVerified?: boolean; isOrg?: boolean; orgVerified?: boolean;
  };
  isAnonymous?: boolean;
  likes: number; isLiked?: boolean;
  thoughts?: number;
  reposts: number; isReposted?: boolean;
  images?: string[];
  image?: string;
  video?: string; videoPoster?: string;
  mediaItems?: MediaItem[];
  category?: string;
  isPinned?: boolean;
}

interface PostCardProps {
  post: Post;
  isLoggedIn?: boolean;
  isOwn?: boolean;
  onPraiseClick?: () => void;
}

/* ── Media grid layout ─────────────────────────────────────────────────────── */
function MediaGrid({ items, onOpen }: { items: MediaItem[]; onOpen: (idx: number) => void }) {
  const n = items.length;
  if (n === 0) return null;

  const Thumb = ({ item, idx, className = "" }: { item: MediaItem; idx: number; className?: string }) => (
    <div
      className={`relative overflow-hidden bg-gray-100 cursor-pointer group ${className}`}
      onClick={(e) => { e.stopPropagation(); onOpen(idx); }}
    >
      {item.type === "video" ? (
        <>
          <img src={item.poster || item.url} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
              <Play size={18} className="text-white ml-0.5" fill="white" />
            </div>
          </div>
        </>
      ) : (
        <img src={item.url} alt="" loading="lazy"
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
      )}
      {n > 4 && idx === 3 && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <span className="text-white text-xl font-bold">+{n - 4}</span>
        </div>
      )}
    </div>
  );

  if (n === 1) return (
    <div className="mt-3 rounded-xl overflow-hidden" style={{ aspectRatio: items[0].aspectRatio || "16/9", maxHeight: 400 }}>
      <Thumb item={items[0]} idx={0} className="w-full h-full" />
    </div>
  );

  if (n === 2) return (
    <div className="mt-3 grid grid-cols-2 gap-0.5 rounded-xl overflow-hidden" style={{ height: 260 }}>
      {items.map((item, i) => <Thumb key={i} item={item} idx={i} className="h-full" />)}
    </div>
  );

  if (n === 3) return (
    <div className="mt-3 grid grid-cols-3 gap-0.5 rounded-xl overflow-hidden" style={{ height: 240 }}>
      <Thumb item={items[0]} idx={0} className="row-span-1 h-full col-span-2" />
      <div className="grid grid-rows-2 gap-0.5 h-full">
        <Thumb item={items[1]} idx={1} className="h-full" />
        <Thumb item={items[2]} idx={2} className="h-full" />
      </div>
    </div>
  );

  return (
    <div className="mt-3 grid grid-cols-2 gap-0.5 rounded-xl overflow-hidden" style={{ maxHeight: 400 }}>
      {items.slice(0, 4).map((item, i) => (
        <Thumb key={i} item={item} idx={i} className="h-44" />
      ))}
    </div>
  );
}

/* ── Media Lightbox ────────────────────────────────────────────────────────── */
function Lightbox({ items, startIdx, onClose }: { items: MediaItem[]; startIdx: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIdx);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const item = items[idx];

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIdx(i => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIdx(i => Math.min(items.length - 1, i + 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, items.length]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center" onClick={onClose}>
      <div className="relative w-full h-full flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white">
          <X size={20} />
        </button>
        {/* Nav */}
        {idx > 0 && (
          <button onClick={() => setIdx(i => i - 1)} className="absolute left-4 z-10 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white">
            <ChevronLeft size={22} />
          </button>
        )}
        {idx < items.length - 1 && (
          <button onClick={() => setIdx(i => i + 1)} className="absolute right-4 z-10 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white">
            <ChevronRight size={22} />
          </button>
        )}
        {/* Content */}
        {item.type === "video" ? (
          <div className="relative">
            <video ref={videoRef} src={item.url} poster={item.poster} muted={muted}
              controls autoPlay className="max-w-full max-h-[85vh] rounded-xl" style={{ objectFit: "contain" }} />
            <button onClick={() => setMuted(!muted)} className="absolute bottom-12 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white">
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
          </div>
        ) : (
          <img src={item.url} alt="" className="max-w-full max-h-[85vh] rounded-xl object-contain" />
        )}
        {/* Dots */}
        {items.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
            {items.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === idx ? "bg-white" : "bg-white/40"}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Hashtag renderer ──────────────────────────────────────────────────────── */
function RenderContent({ text, isLoggedIn, onHashtagClick }: { text: string; isLoggedIn: boolean; onHashtagClick: (tag: string) => void }) {
  const navigate = useNavigate();
  const parts = text.split(/(#\w+)/gu);
  return (
    <>
      {parts.map((part, i) => {
        if (/^#\w+$/u.test(part)) {
          return (
            <span key={i} className="text-blue-600 font-semibold cursor-pointer hover:text-blue-700 hover:underline transition-colors"
              onClick={(e) => { e.stopPropagation(); onHashtagClick(part); }}>
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN POSTCARD
══════════════════════════════════════════════════════════════════════════════ */
export function PostCard({ post, isLoggedIn = false, isOwn = false }: PostCardProps) {
  const navigate = useNavigate();

  const [praised, setPraised] = useState(post.isLiked ?? false);
  const [forwarded, setForwarded] = useState(post.isReposted ?? false);
  const [saved, setSaved] = useState(false);
  const [praiseCount, setPraiseCount] = useState(post.likes);
  const [forwardCount, setForwardCount] = useState(post.reposts);
  const [showMenu, setShowMenu] = useState(false);
  const [gateAction, setGateAction] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const allMedia: MediaItem[] = useMemo(() => {
    if (post.mediaItems?.length) return post.mediaItems;
    const items: MediaItem[] = [];
    if (post.images) post.images.forEach(url => items.push({ type: "image", url }));
    else if (post.image) items.push({ type: "image", url: post.image });
    if (post.video) items.push({ type: "video", url: post.video, poster: post.videoPoster || post.image });
    return items;
  }, [post]);

  const gate = (action: string, fn: () => void) => {
    if (!isLoggedIn) { setGateAction(action); return; }
    fn();
  };

  const handlePraise = (e: React.MouseEvent) => {
    e.stopPropagation();
    gate("praise", () => {
      setPraised(p => !p);
      setPraiseCount(c => praised ? c - 1 : c + 1);
    });
  };

  const handleForward = (e: React.MouseEvent) => {
    e.stopPropagation();
    gate("forward", () => {
      setForwarded(p => !p);
      setForwardCount(c => forwarded ? c - 1 : c + 1);
    });
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    gate("bookmark", () => setSaved(p => !p));
  };

  const handleThought = (e: React.MouseEvent) => {
    e.stopPropagation();
    gate("thought", () => navigate(`/thoughts/${post.id}`));
  };

  const handleHashtag = (tag: string) => {
    if (isLoggedIn) navigate(`/feed/search?q=${tag}`);
    else navigate(`/search?q=${tag}`);
  };

  const openProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (post.isAnonymous) return;
    gate("profile", () => navigate(`/user/${post.user.id}`));
  };

  const author = post.isAnonymous
    ? { name: post.user.anonUsername || "Anonymous", avatar: null, verified: false }
    : { name: post.user.name, avatar: post.user.avatar, verified: post.user.isVerified, isOrg: post.user.isOrg };

  return (
    <>
      <article
        className="bg-white border-b border-gray-100 hover:bg-gray-50/30 transition-colors cursor-pointer"
        onClick={() => navigate(`/thoughts/${post.id}`)}
      >
        {post.isPinned && (
          <div className="flex items-center gap-1.5 px-4 pt-2 text-xs text-gray-400 font-semibold">
            <span>📌</span> Pinned Quote
          </div>
        )}
        <div className="px-4 py-3 flex gap-3">
          {/* Avatar */}
          <div className="shrink-0 mt-0.5" onClick={openProfile}>
            {post.isAnonymous ? (
              <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center cursor-default">
                <Shield size={18} className="text-gray-300" />
              </div>
            ) : (
              <div className="cursor-pointer" onClick={openProfile}>
                {author.isOrg ? (
                  <img src={author.avatar!} alt={author.name}
                    className="w-10 h-10 rounded-xl object-cover ring-1 ring-gray-200 hover:ring-blue-200 transition-all" />
                ) : (
                  <img src={author.avatar!} alt={author.name}
                    className="w-10 h-10 rounded-full object-cover ring-1 ring-gray-200 hover:ring-blue-200 transition-all" />
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span
                  className={`font-bold text-gray-900 text-sm truncate max-w-[150px] ${!post.isAnonymous ? "hover:underline cursor-pointer" : ""}`}
                  onClick={openProfile}
                >
                  {author.name}
                </span>
                {/* Verified badge */}
                {!post.isAnonymous && author.verified && (
                  author.isOrg
                    ? <span className="inline-flex items-center justify-center w-3.5 h-3.5 bg-gray-900 rounded text-[9px] text-white font-bold">✓</span>
                    : <span className="inline-flex items-center justify-center w-3.5 h-3.5 bg-blue-500 rounded-full text-[9px] text-white font-bold">✓</span>
                )}
                {post.isAnonymous && (
                  <span className="text-[10px] bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded-full font-medium">anon</span>
                )}
                <span className="text-gray-400 text-xs">·</span>
                <span className="text-gray-400 text-xs">{post.timestamp}</span>
                {post.category && (
                  <>
                    <span className="text-gray-300 text-xs">·</span>
                    <span className="text-xs text-blue-500 font-medium">{post.category}</span>
                  </>
                )}
              </div>
              {/* Menu */}
              <div className="relative shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all"
                >
                  <MoreHorizontal size={16} />
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
                    <div className="absolute right-0 top-8 z-40 bg-white rounded-2xl shadow-xl border border-gray-100 py-1 min-w-[160px]">
                      {isOwn ? (
                        <>
                          <MenuItem icon={<span>📌</span>} label="Pin Quote" onClick={() => setShowMenu(false)} />
                          <MenuItem icon={<span>✏️</span>} label="Edit" onClick={() => setShowMenu(false)} />
                          <MenuItem icon={<span>🚫</span>} label="Turn off Thoughts" onClick={() => setShowMenu(false)} />
                          <MenuItem icon={<span className="text-red-500">🗑️</span>} label="Delete" danger onClick={() => setShowMenu(false)} />
                        </>
                      ) : (
                        <>
                          <MenuItem icon={<Link2 size={14} />} label="Copy link" onClick={() => { navigator.clipboard.writeText(window.location.origin + `/thoughts/${post.id}`); setShowMenu(false); }} />
                          <MenuItem icon={<Repeat2 size={14} />} label="Forward" onClick={(e) => { setShowMenu(false); handleForward(e); }} />
                          <MenuItem icon={<Flag size={14} />} label="Report" onClick={() => { setShowMenu(false); navigate(`/report/${post.id}`); }} />
                          {isLoggedIn && <MenuItem icon={<UserMinus size={14} />} label="Block user" danger onClick={() => setShowMenu(false)} />}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Text */}
            <p className="text-gray-900 text-sm leading-relaxed mt-1">
              <RenderContent text={post.content} isLoggedIn={isLoggedIn} onHashtagClick={handleHashtag} />
            </p>

            {/* Media */}
            <MediaGrid items={allMedia} onOpen={(idx) => setLightboxIdx(idx)} />

            {/* Action bar */}
            <div className="flex items-center justify-between mt-3 -ml-1.5">
              {/* Thoughts */}
              <button onClick={handleThought}
                className="flex items-center gap-1.5 text-gray-400 hover:text-blue-500 transition-colors group px-1.5 py-1 rounded-xl hover:bg-blue-50"
              >
                <MessageCircle size={17} className="group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold">{(post.thoughts ?? 0) > 0 ? post.thoughts : ""}</span>
              </button>

              {/* Forward */}
              <button onClick={handleForward}
                className={`flex items-center gap-1.5 transition-colors group px-1.5 py-1 rounded-xl hover:bg-green-50 ${forwarded ? "text-green-500" : "text-gray-400 hover:text-green-500"}`}
              >
                <Repeat2 size={17} className="group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold">{forwardCount > 0 ? forwardCount : ""}</span>
              </button>

              {/* Praise (like) */}
              <button onClick={handlePraise}
                className={`flex items-center gap-1.5 transition-colors group px-1.5 py-1 rounded-xl hover:bg-red-50 ${praised ? "text-red-500" : "text-gray-400 hover:text-red-500"}`}
              >
                <Heart size={17} fill={praised ? "currentColor" : "none"} className="group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold">{praiseCount > 0 ? praiseCount : ""}</span>
              </button>

              {/* Bookmark */}
              <button onClick={handleBookmark}
                className={`flex items-center gap-1.5 transition-colors group px-1.5 py-1 rounded-xl hover:bg-yellow-50 ${saved ? "text-yellow-500" : "text-gray-400 hover:text-yellow-500"}`}
              >
                <Bookmark size={17} fill={saved ? "currentColor" : "none"} className="group-hover:scale-110 transition-transform" />
              </button>

              {/* Share */}
              <button
                onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(window.location.origin + `/thoughts/${post.id}`); }}
                className="flex items-center gap-1.5 text-gray-400 hover:text-blue-500 transition-colors group px-1.5 py-1 rounded-xl hover:bg-blue-50"
              >
                <Share2 size={15} className="group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </article>

      {/* Gate sheet */}
      {!isLoggedIn && gateAction && (
        <LoginGateSheet action={gateAction as any} onClose={() => setGateAction(null)} />
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox items={allMedia} startIdx={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}
    </>
  );
}

function MenuItem({ icon, label, onClick, danger = false }: { icon: React.ReactNode; label: string; onClick: (e: React.MouseEvent) => void; danger?: boolean }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(e); }}
      className={`flex items-center gap-2.5 w-full px-4 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50 ${danger ? "text-red-500 hover:bg-red-50" : "text-gray-700"}`}>
      {icon}{label}
    </button>
  );
}

import React, { useState, useRef, useEffect } from "react";
import { X, Maximize2, Minimize2, ChevronLeft, ChevronRight, ThumbsUp, MessageCircle, Repeat2, Share2, Bookmark } from "lucide-react";

interface MediaViewerProps {
  media: { src: string; type: "image" | "video" }[];
  initialIndex?: number;
  post?: any;
  onClose: () => void;
}

export function MediaViewer({ media, initialIndex = 0, post, onClose }: MediaViewerProps) {
  const [idx, setIdx] = useState(initialIndex);
  const [liked, setLiked] = useState(post?.isLiked || false);
  const [likeCount, setLikeCount] = useState(post?.likes || 0);
  const [saved, setSaved] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const current = media[idx];

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const fmt = (n: number) => n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex" onClick={onClose}>
      {/* Main media area */}
      <div
        className="flex-1 flex flex-col items-center justify-center relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-10 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
        >
          <X size={18} />
        </button>

        {/* Prev/Next */}
        {idx > 0 && (
          <button
            onClick={() => setIdx(idx - 1)}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {idx < media.length - 1 && (
          <button
            onClick={() => setIdx(idx + 1)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 lg:right-80"
          >
            <ChevronRight size={20} />
          </button>
        )}

        {/* Media */}
        {current.type === "image" ? (
          <img
            src={current.src}
            alt="media"
            className="max-h-screen max-w-full object-contain"
            style={{ maxWidth: "calc(100vw - 320px)" }}
          />
        ) : (
          <video
            ref={videoRef}
            src={current.src}
            controls
            autoPlay
            className="max-h-screen max-w-full"
            style={{ maxWidth: "calc(100vw - 320px)" }}
          />
        )}

        {/* Dot indicators */}
        {media.length > 1 && (
          <div className="flex gap-2 mt-4">
            {media.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === idx ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right panel — post info (desktop) */}
      {post && (
        <div
          className="hidden lg:flex flex-col w-72 bg-white/5 backdrop-blur-md border-l border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* User */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
            <img src={post.user.avatar} alt={post.user.name} className="w-10 h-10 rounded-full object-cover" />
            <div>
              <p className="text-white text-sm font-semibold">{post.user.name}</p>
              <p className="text-white/50 text-xs">{post.user.username}</p>
            </div>
          </div>

          {/* Post content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <p className="text-white/70 text-sm leading-relaxed">
              {post.content.split(" ").map((w: string, i: number) =>
                w.startsWith("#") ? <span key={i} className="text-blue-400">{w} </span> : w + " "
              )}
            </p>
            <p className="text-white/30 text-xs mt-3">{post.timestamp}</p>
          </div>

          {/* Actions */}
          <div className="border-t border-white/10 px-5 py-4 space-y-3">
            <button
              onClick={() => { setLiked(!liked); setLikeCount((c) => liked ? c - 1 : c + 1); }}
              className={`flex items-center gap-3 w-full ${liked ? "text-orange-400" : "text-white/60 hover:text-white"} transition-colors`}
            >
              <ThumbsUp size={18} className={liked ? "fill-orange-400" : ""} />
              <span className="text-sm">{fmt(likeCount)} likes</span>
            </button>
            <button className="flex items-center gap-3 w-full text-white/60 hover:text-white transition-colors">
              <MessageCircle size={18} />
              <span className="text-sm">{fmt(post.thoughts)} comments</span>
            </button>
            <button className="flex items-center gap-3 w-full text-white/60 hover:text-white transition-colors">
              <Repeat2 size={18} />
              <span className="text-sm">{fmt(post.reposts)} reposts</span>
            </button>
            <button className="flex items-center gap-3 w-full text-white/60 hover:text-white transition-colors">
              <Share2 size={18} />
              <span className="text-sm">Share</span>
            </button>
            <button
              onClick={() => setSaved(!saved)}
              className={`flex items-center gap-3 w-full transition-colors ${saved ? "text-blue-400" : "text-white/60 hover:text-white"}`}
            >
              <Bookmark size={18} className={saved ? "fill-blue-400" : ""} />
              <span className="text-sm">{saved ? "Saved" : "Save"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Mobile bottom actions */}
      {post && (
        <div
          className="lg:hidden absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-8 pb-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-around">
            <button
              onClick={() => { setLiked(!liked); setLikeCount((c) => liked ? c - 1 : c + 1); }}
              className={`flex flex-col items-center gap-1 ${liked ? "text-orange-400" : "text-white/70"}`}
            >
              <ThumbsUp size={20} className={liked ? "fill-orange-400" : ""} />
              <span className="text-xs">{fmt(likeCount)}</span>
            </button>
            <button className="flex flex-col items-center gap-1 text-white/70">
              <MessageCircle size={20} />
              <span className="text-xs">{fmt(post.thoughts)}</span>
            </button>
            <button className="flex flex-col items-center gap-1 text-white/70">
              <Repeat2 size={20} />
              <span className="text-xs">{fmt(post.reposts)}</span>
            </button>
            <button className="flex flex-col items-center gap-1 text-white/70">
              <Share2 size={20} />
              <span className="text-xs">Share</span>
            </button>
            <button
              onClick={() => setSaved(!saved)}
              className={`flex flex-col items-center gap-1 ${saved ? "text-blue-400" : "text-white/70"}`}
            >
              <Bookmark size={20} className={saved ? "fill-blue-400" : ""} />
              <span className="text-xs">Save</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline video player for feed posts
export function InlineVideoPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (playing) { videoRef.current.pause(); setPlaying(false); }
    else { videoRef.current.play(); setPlaying(true); }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="relative bg-black rounded-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <video
        ref={videoRef}
        src={src}
        className="w-full"
        muted={muted}
        loop
        onTimeUpdate={() => {
          if (videoRef.current) setProgress(videoRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) setDuration(videoRef.current.duration);
        }}
      />
      {/* Play overlay */}
      {!playing && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30"
        >
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <div className="w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[18px] border-l-white ml-1" />
          </div>
        </button>
      )}
      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6">
        {/* Progress bar */}
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={progress}
          onChange={(e) => {
            e.stopPropagation();
            if (videoRef.current) videoRef.current.currentTime = Number(e.target.value);
            setProgress(Number(e.target.value));
          }}
          className="w-full h-1 mb-2 accent-blue-500"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex items-center justify-between gap-2">
          <button onClick={togglePlay} className="text-white">
            {playing ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            ) : (
              <div className="w-0 h-0 border-t-[7px] border-t-transparent border-b-[7px] border-b-transparent border-l-[12px] border-l-white ml-0.5" />
            )}
          </button>
          <span className="text-white text-xs flex-1">{fmt(progress)} / {fmt(duration)}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setMuted(!muted); if (videoRef.current) videoRef.current.muted = !muted; }}
            className="text-white text-xs px-2 py-0.5 bg-white/20 rounded"
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
      </div>
    </div>
  );
}

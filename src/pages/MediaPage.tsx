import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft, Play, Pause, Volume2, VolumeX,
  Maximize2, ChevronLeft, ChevronRight, Download,
} from "lucide-react";
import { fetchPostById, type LivePost } from "../services/feedService";
import { useAuth } from "../contexts/AuthContext";

/* ══════════════════════════════════════════════════════════════
   MediaPage — Route: /media/:postId/:index
   Standalone full-screen media viewer.
   Opened when user taps an image or video in a PostCard.

   Features:
   • Full-screen immersive view
   • Swipe between media items
   • Video playback with all controls
   • Double-tap to go back
   • Long press → blocked (anti-piracy)
   • Download blocked
   • Back button top-left
══════════════════════════════════════════════════════════════ */

const getMutePref  = (): boolean => localStorage.getItem("sphere_video_muted") !== "false";
const saveMutePref = (v: boolean) => localStorage.setItem("sphere_video_muted", String(v));
const fmtTime      = (s: number): string => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,"0")}`;

export function MediaPage() {
  const { postId, index } = useParams<{ postId: string; index: string }>();
  const navigate           = useNavigate();
  const { user }           = useAuth();

  const [post,         setPost]         = useState<LivePost | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [mediaIdx,     setMediaIdx]     = useState(Number(index ?? 0));
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoMuted,   setVideoMuted]   = useState(getMutePref);
  const [videoCurrent, setVideoCurrent] = useState(0);
  const [videoDuration,setVideoDuration]= useState(0);
  const [showControls, setShowControls] = useState(true);
  const [touchStartX,  setTouchStartX]  = useState(0);
  const videoRef   = useRef<HTMLVideoElement>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!postId) return;
    fetchPostById(postId, user?.id).then(p => { setPost(p); setLoading(false); });
  }, [postId]);

  /* Auto-hide controls after 3s */
  const resetControlsTimer = () => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  };
  useEffect(() => { resetControlsTimer(); return () => clearTimeout(controlsTimer.current); }, []);

  /* Lock body scroll */
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  /* Apply mute to video */
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = videoMuted;
  }, [videoMuted, mediaIdx]);

  const allMedia = post?.mediaItems ?? [];
  const item     = allMedia[mediaIdx];

  const blockContextMenu = (e: any) => e.preventDefault();

  const handleSwipeStart = (e: React.TouchEvent) => setTouchStartX(e.targetTouches[0].clientX);
  const handleSwipeEnd   = (e: React.TouchEvent) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) < 50) return;
    if (diff > 0 && mediaIdx < allMedia.length - 1) setMediaIdx(p => p + 1);
    else if (diff < 0 && mediaIdx > 0)              setMediaIdx(p => p - 1);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    videoPlaying ? videoRef.current.pause() : videoRef.current.play();
    resetControlsTimer();
  };
  const toggleMute = () => {
    const next = !videoMuted;
    setVideoMuted(next);
    saveMutePref(next);
    if (videoRef.current) videoRef.current.muted = next;
    resetControlsTimer();
  };
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Number(e.target.value);
    setVideoCurrent(Number(e.target.value));
    resetControlsTimer();
  };

  if (loading || !post) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 gap-4">
        <p className="text-white/60 text-sm">Media not found</p>
        <button onClick={() => navigate(-1)} className="text-blue-400 text-sm font-bold">Go back</button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black z-50 flex flex-col"
      onClick={resetControlsTimer}
      onTouchStart={handleSwipeStart}
      onTouchEnd={handleSwipeEnd}
      onContextMenu={blockContextMenu}
    >
      {/* ── Top bar ── */}
      <div className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-4 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}>
        <button onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors">
          <ArrowLeft size={20} />
        </button>
        {allMedia.length > 1 && (
          <span className="text-white/80 text-sm font-medium bg-black/40 px-3 py-1 rounded-full">
            {mediaIdx + 1} / {allMedia.length}
          </span>
        )}
        <div className="w-10" /> {/* spacer */}
      </div>

      {/* ── Media content ── */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {item.type === "image" ? (
          <img
            src={item.url}
            alt="media"
            draggable={false}
            className="max-w-full max-h-full object-contain select-none"
            onContextMenu={blockContextMenu}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" onClick={togglePlay}>
            <video
              ref={videoRef}
              src={item.url}
              muted={videoMuted}
              playsInline
              className="max-w-full max-h-full object-contain"
              onPlay={() => setVideoPlaying(true)}
              onPause={() => setVideoPlaying(false)}
              onTimeUpdate={e => setVideoCurrent(e.currentTarget.currentTime)}
              onLoadedMetadata={e => setVideoDuration(e.currentTarget.duration || 0)}
              onContextMenu={blockContextMenu}
            />
            {/* Big play overlay */}
            {!videoPlaying && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-20 h-20 rounded-full bg-black/50 flex items-center justify-center">
                  <Play size={32} fill="white" className="text-white ml-2" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Nav arrows */}
        {allMedia.length > 1 && mediaIdx > 0 && (
          <button onClick={e => { e.stopPropagation(); setMediaIdx(p => p - 1); }}
            className={`absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 z-10 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}>
            <ChevronLeft size={20} />
          </button>
        )}
        {allMedia.length > 1 && mediaIdx < allMedia.length - 1 && (
          <button onClick={e => { e.stopPropagation(); setMediaIdx(p => p + 1); }}
            className={`absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 z-10 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}>
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {/* ── Video controls bar ── */}
      {item.type === "video" && (
        <div className={`absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-4 pb-8 pt-12 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}>
          {/* Progress bar */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-white/80 text-xs font-mono shrink-0">{fmtTime(videoCurrent)}</span>
            <input
              type="range" min={0} max={videoDuration || 100} value={videoCurrent}
              onChange={handleSeek} onClick={e => e.stopPropagation()}
              className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer"
              style={{ background: `linear-gradient(to right, white ${(videoCurrent / (videoDuration || 1)) * 100}%, rgba(255,255,255,0.25) 0%)` }}
            />
            <span className="text-white/80 text-xs font-mono shrink-0">{fmtTime(videoDuration)}</span>
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                {videoPlaying ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" className="ml-0.5" />}
              </button>
              <button onClick={toggleMute}
                className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                {videoMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            </div>
            {/* No fullscreen on mobile — already full screen */}
          </div>
        </div>
      )}

      {/* ── Dot indicators ── */}
      {allMedia.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {allMedia.map((_, i) => (
            <button key={i} onClick={() => setMediaIdx(i)}
              className={`rounded-full transition-all ${i === mediaIdx ? "bg-white w-5 h-2" : "bg-white/40 w-2 h-2"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

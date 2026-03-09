import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, X, Camera, Video, Type, Send, Check, ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { mockStoriesUsers, currentUser } from "../mockData";
import { getStatusGradient } from "../../contexts/GuestContext";

const GRADIENT_CLASSES = [
  "anon-grad-0","anon-grad-1","anon-grad-2","anon-grad-3",
  "anon-grad-4","anon-grad-5","anon-grad-6","anon-grad-7",
  "anon-grad-8","anon-grad-9","anon-grad-10","anon-grad-11",
];

/* ── Story viewer ── */
function StoryViewer({ stories, startIdx, onClose }: { stories: any[]; startIdx: number; onClose: () => void }) {
  const [userIdx, setUserIdx] = useState(startIdx);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const DURATION = 5000; // 5s per image/text story

  const story = stories[userIdx];
  // Demo: each user has one "item"
  const item = {
    type: "text" as const,
    text: `${story.user.name}'s status update! 🌟 Life is good.`,
    gradient: GRADIENT_CLASSES[getStatusGradient(story.user.name)],
    timestamp: "2h ago",
  };

  useEffect(() => {
    setProgress(0);
    if (paused) return;
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(intervalRef.current);
          // advance to next
          setUserIdx(u => {
            if (u < stories.length - 1) { setStoryIdx(0); return u + 1; }
            onClose(); return u;
          });
          return 0;
        }
        return p + (100 / (DURATION / 100));
      });
    }, 100);
    return () => clearInterval(intervalRef.current);
  }, [userIdx, storyIdx, paused]);

  const goNext = () => {
    if (userIdx < stories.length - 1) { setUserIdx(u => u + 1); setStoryIdx(0); setProgress(0); }
    else onClose();
  };
  const goPrev = () => {
    if (userIdx > 0) { setUserIdx(u => u - 1); setStoryIdx(0); setProgress(0); }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      <div className="relative w-full max-w-sm h-full mx-auto flex flex-col">
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 p-3 pt-4">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/30 rounded overflow-hidden">
              <div className="h-full bg-white rounded transition-none"
                style={{ width: i < userIdx ? "100%" : i === userIdx ? `${progress}%` : "0%" }} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-0 right-0 z-10 flex items-center justify-between px-4 mt-3">
          <div className="flex items-center gap-2">
            <img src={story.user.avatar} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-white/50" />
            <div>
              <p className="text-white text-sm font-bold">{story.user.name}</p>
              <p className="text-white/60 text-xs">{item.timestamp}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPaused(p => !p)} className="w-8 h-8 rounded-full bg-black/30 flex items-center justify-center text-white">
              {paused ? <Play size={14} /> : <Pause size={14} />}
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/30 flex items-center justify-center text-white">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content — always object-contain, never crops */}
        <div className={`flex-1 flex items-center justify-center ${item.type === "text" ? item.gradient : "bg-black"}`}>
          {item.type === "text" && (
            <div className="text-center px-8">
              <p className="text-white font-bold text-xl leading-relaxed" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                {item.text}
              </p>
            </div>
          )}
        </div>

        {/* Tap zones */}
        <button className="absolute left-0 top-0 bottom-0 w-1/3 z-5" onClick={goPrev} />
        <button className="absolute right-0 top-0 bottom-0 w-1/3 z-5" onClick={goNext} />

        {/* Reply bar */}
        <div className="absolute bottom-6 left-0 right-0 px-4 flex items-center gap-2 z-10">
          <input type="text" placeholder={`Reply to ${story.user.name}…`}
            className="flex-1 bg-white/20 backdrop-blur-sm text-white placeholder-white/60 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/30" />
          <button className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Create status page ── */
export function StatusPage() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [viewerIdx, setViewerIdx] = useState<number | null>(userId ? 0 : null);
  const [mode, setMode] = useState<"pick"|"text"|"media">("pick");
  const [text, setText] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image"|"video"|null>(null);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const user = currentUser as any;
  const gradientIdx = text ? getStatusGradient(text) : 3;
  const gradientClass = GRADIENT_CLASSES[gradientIdx];

  /* Open viewer if userId provided */
  useEffect(() => {
    if (userId) {
      const idx = mockStoriesUsers.findIndex((s: any) => s.user.id === userId);
      setViewerIdx(idx >= 0 ? idx : 0);
    }
  }, [userId]);

  const handleFile = (file: File) => {
    if (file.type.startsWith("image/")) {
      setMediaType("image");
      setMediaUrl(URL.createObjectURL(file));
      setMediaFile(file);
      setMode("media");
    } else if (file.type.startsWith("video/")) {
      const vid = document.createElement("video");
      const url = URL.createObjectURL(file);
      vid.preload = "metadata";
      vid.onloadedmetadata = () => {
        if (vid.duration > 60) { alert("Status videos must be under 1 minute"); URL.revokeObjectURL(url); return; }
        setMediaType("video");
        setMediaUrl(url);
        setMediaFile(file);
        setMode("media");
      };
      vid.src = url;
    }
  };

  const handlePost = async () => {
    if (!text.trim() && !mediaFile) return;
    setPosting(true);
    await new Promise(r => setTimeout(r, 1000));
    setPosted(true);
    setTimeout(() => navigate("/feed"), 900);
  };

  /* Viewer mode */
  if (viewerIdx !== null) {
    return (
      <StoryViewer
        stories={mockStoriesUsers}
        startIdx={viewerIdx}
        onClose={() => { setViewerIdx(null); navigate("/feed"); }}
      />
    );
  }

  /* Create mode */
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900 flex-1">Add Status</h1>
        {(text.trim() || mediaFile) && (
          <button onClick={handlePost} disabled={posting || posted}
            className="px-5 py-2 bg-blue-600 text-white rounded-full font-bold text-sm hover:bg-blue-700 disabled:opacity-60 transition-all flex items-center gap-1.5">
            {posted ? <><Check size={14} /> Shared!</> : posting ? "Sharing…" : "Share"}
          </button>
        )}
      </div>

      {/* Existing stories row */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <p className="text-xs text-gray-400 font-semibold mb-2 uppercase tracking-wide">Recent Stories</p>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide">
          {mockStoriesUsers.map((s: any, i: number) => (
            <div key={s.id} className="flex flex-col items-center gap-1 shrink-0 cursor-pointer" onClick={() => setViewerIdx(i)}>
              <div className={`p-[2.5px] rounded-full ${s.seen ? "story-ring-seen" : "story-ring"}`}>
                <img src={s.user.avatar} alt={s.user.name} className="w-12 h-12 rounded-full object-cover ring-[2px] ring-white" />
              </div>
              <span className="text-[10px] text-gray-500 font-medium max-w-[48px] truncate text-center">{s.user.name.split(" ")[0]}</span>
            </div>
          ))}
        </div>
      </div>

      {mode === "pick" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
          <div className="text-center">
            <div className={`w-20 h-20 rounded-3xl ${GRADIENT_CLASSES[3]} mx-auto mb-4 flex items-center justify-center`}>
              <span className="text-white font-sphere text-2xl">s</span>
            </div>
            <p className="font-bold text-gray-900 text-lg">Share a Status</p>
            <p className="text-sm text-gray-500 mt-1">Share a thought, photo, or video — disappears in 24 hours</p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={() => setMode("text")}
              className="flex items-center gap-3 px-5 py-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center"><Type size={20} className="text-blue-600" /></div>
              <div className="text-left">
                <p className="font-bold text-gray-900 text-sm">Text Status</p>
                <p className="text-xs text-gray-500">Auto-generated gradient background</p>
              </div>
            </button>
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-3 px-5 py-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center"><Camera size={20} className="text-green-600" /></div>
              <div className="text-left">
                <p className="font-bold text-gray-900 text-sm">Photo or Video</p>
                <p className="text-xs text-gray-500">Up to 1 minute for video</p>
              </div>
            </button>
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
        </div>
      )}

      {mode === "text" && (
        <div className="flex-1 flex flex-col">
          {/* Preview */}
          <div className={`flex-1 flex items-center justify-center ${gradientClass} min-h-64`}>
            {text ? (
              <p className="text-white font-bold text-xl text-center px-8 leading-relaxed" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
                {text}
              </p>
            ) : (
              <p className="text-white/50 text-lg font-semibold">Start typing…</p>
            )}
          </div>
          {/* Input */}
          <div className="bg-white px-4 py-4">
            <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 200))}
              placeholder="What's on your mind?" rows={3} autoFocus
              className="w-full resize-none text-gray-900 text-base focus:outline-none" />
            <p className="text-xs text-gray-400 text-right mt-1">{text.length}/200</p>
          </div>
        </div>
      )}

      {mode === "media" && mediaUrl && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 bg-black flex items-center justify-center">
            {mediaType === "image" ? (
              <img src={mediaUrl} alt="" className="max-w-full max-h-[70vh]" style={{ objectFit: "contain" }} />
            ) : (
              <video src={mediaUrl} controls autoPlay muted loop className="max-w-full max-h-[70vh]" style={{ objectFit: "contain" }} />
            )}
          </div>
          <div className="bg-white px-4 py-4">
            <input type="text" value={text} onChange={(e) => setText(e.target.value.slice(0,100))}
              placeholder="Add a caption…"
              className="w-full px-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 text-gray-900" />
          </div>
        </div>
      )}
    </div>
  );
}

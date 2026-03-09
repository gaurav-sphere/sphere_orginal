import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft, Image, Video, X, Shield, User, Hash,
  ChevronDown, AlertCircle, Loader2, Check,
} from "lucide-react";
import { AppShell } from "../components/AppShell";
import { currentUser } from "../mockData";

/* ── Anon PIN Modal ─────────────────────────────────────────────────────────── */
function AnonPinModal({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shaking, setShaking] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    if (!locked) return;
    const interval = setInterval(() => {
      setLockTimer(t => {
        if (t <= 1) { setLocked(false); clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [locked]);

  const handlePin = (newPin: string) => {
    if (locked) return;
    setPin(newPin);
    setError("");
    if (newPin.length === 4) {
      // In production: call /verify-anon-pin Edge Function
      // For demo: PIN = "1234"
      if (newPin === "1234") {
        onSuccess();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setShaking(true);
        setError(newAttempts >= 4 ? "Too many attempts" : `Incorrect PIN — ${5 - newAttempts} attempts left`);
        setTimeout(() => { setShaking(false); setPin(""); }, 500);
        if (newAttempts >= 5) {
          setLocked(true);
          setLockTimer(1800); // 30 min
          setError("Too many wrong attempts. Locked for 30 minutes.");
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm mx-auto bg-white rounded-t-3xl lg:rounded-3xl p-7 shadow-2xl sheet-up">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center">
            <Shield size={28} className="text-white" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold text-gray-900">Enter Anon PIN</h2>
            <p className="text-sm text-gray-500 mt-1">Confirm your 4-digit PIN to post anonymously</p>
          </div>

          {/* PIN dots */}
          <div className={`flex gap-4 mt-2 ${shaking ? "pin-shake" : ""}`} onClick={() => inputRef.current?.focus()}>
            {[0,1,2,3].map((i) => (
              <div key={i} className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${
                pin[i] ? "bg-gray-900 border-gray-900" : "bg-gray-100 border-gray-300"
              }`}>
                {pin[i] && <div className="w-3.5 h-3.5 rounded-full bg-white" />}
              </div>
            ))}
          </div>

          {/* Hidden real input */}
          <input
            ref={inputRef}
            type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={4}
            value={pin} onChange={(e) => handlePin(e.target.value.replace(/\D/g,"").slice(0,4))}
            disabled={locked}
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
          />

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm font-medium">
              <AlertCircle size={14} />{error}
            </div>
          )}
          {locked && (
            <p className="text-xs text-gray-400">
              Try again in {Math.floor(lockTimer/60)}:{String(lockTimer%60).padStart(2,"0")}
            </p>
          )}

          <button onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
          <button className="text-xs text-blue-600 hover:text-blue-700 font-semibold">Forgot PIN? → Settings</button>
        </div>
      </div>
    </div>
  );
}

/* ── Attachment thumbnail ── */
function AttachThumb({
  item, idx, onRemove, progress
}: {
  item: { type: "image"|"video"; url: string; file: File; duration?: number };
  idx: number; onRemove: () => void; progress?: number;
}) {
  return (
    <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 shrink-0">
      <img src={item.url} alt="" className="w-full h-full object-cover" />
      {item.type === "video" && (
        <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-medium">
          {item.duration ? `${Math.floor(item.duration / 60)}:${String(Math.round(item.duration % 60)).padStart(2,"0")}` : "VIDEO"}
        </div>
      )}
      {typeof progress === "number" && progress < 100 && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
            <circle cx="18" cy="18" r="14" fill="none" stroke="white" strokeWidth="3"
              strokeDasharray={`${2 * Math.PI * 14}`}
              strokeDashoffset={`${2 * Math.PI * 14 * (1 - progress / 100)}`}
              strokeLinecap="round" className="transition-all duration-300" />
          </svg>
          <span className="absolute text-white text-[10px] font-bold">{progress}%</span>
        </div>
      )}
      <button
        onClick={onRemove}
        className="absolute -top-1 -right-1 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center hover:bg-red-500 transition-colors z-10"
      >
        <X size={10} className="text-white" />
      </button>
    </div>
  );
}

/* ── Categories ── */
const POST_CATS = ["Technology","Cricket","Sports","Bollywood","Entertainment","Science","Politics","City","Music","Travel","Food","Gaming","Finance"];

/* ════════════════════════════════════════════════════════════════════════════ */
export function CreatePostPage() {
  const navigate = useNavigate();
  const [isAnon, setIsAnon] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [allowThoughts, setAllowThoughts] = useState(true);
  const [attachments, setAttachments] = useState<Array<{ type: "image"|"video"; url: string; file: File; duration?: number }>>([]);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [draftsaved, setDraftSaved] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout>>();

  const user = currentUser as any;
  const MAX_ATTACHMENTS = 10;
  const charLeft = 500 - content.length;

  /* ── Draft auto-save ── */
  useEffect(() => {
    if (!content && attachments.length === 0) return;
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      localStorage.setItem("sphere_draft", JSON.stringify({ content, category, isAnon, ts: Date.now() }));
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 1500);
    }, 10000);
    return () => clearTimeout(draftTimer.current);
  }, [content, category, isAnon]);

  /* ── Load draft on mount ── */
  useEffect(() => {
    const raw = localStorage.getItem("sphere_draft");
    if (raw) {
      try {
        const draft = JSON.parse(raw);
        const age = Date.now() - draft.ts;
        if (age < 86400000) { // 24 hours
          setContent(draft.content || "");
          setCategory(draft.category || "");
        }
      } catch {}
    }
    textRef.current?.focus();
  }, []);

  /* ── Toggle anon ── */
  const toggleAnon = () => {
    if (!isAnon) {
      if (!pinVerified) { setShowPinModal(true); return; }
      setIsAnon(true);
    } else {
      setIsAnon(false);
    }
  };

  const onPinSuccess = () => {
    setShowPinModal(false);
    setPinVerified(true);
    setIsAnon(true);
  };

  /* ── File handlers ── */
  const addImages = (files: FileList) => {
    const remaining = MAX_ATTACHMENTS - attachments.length;
    Array.from(files).slice(0, remaining).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      if (file.size > 10 * 1024 * 1024) { alert(`${file.name} exceeds 10MB limit`); return; }
      const url = URL.createObjectURL(file);
      setAttachments(prev => [...prev, { type: "image", url, file }]);
    });
  };

  const addVideo = (file: File) => {
    if (!file.type.startsWith("video/")) return;
    if (file.size > 500 * 1024 * 1024) { alert("Video exceeds 500MB limit"); return; }
    const url = URL.createObjectURL(file);
    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.onloadedmetadata = () => {
      if (vid.duration > 1200) { alert("Video must be under 20 minutes"); URL.revokeObjectURL(url); return; }
      if (vid.duration < 3) { alert("Video must be at least 3 seconds"); URL.revokeObjectURL(url); return; }
      setAttachments(prev => [...prev, { type: "video", url, file, duration: vid.duration }]);
    };
    vid.src = url;
  };

  const removeAttachment = (idx: number) => {
    setAttachments(prev => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  /* ── Hashtag detection ── */
  const extractedTags = [...content.matchAll(/#(\w+)/gu)].map(m => m[0]);

  /* ── Post ── */
  const handlePost = async () => {
    if (!content.trim() && attachments.length === 0) return;
    setPosting(true);
    // In production: upload attachments to Supabase Storage, then insert post
    await new Promise(r => setTimeout(r, 1200));
    localStorage.removeItem("sphere_draft");
    setPosted(true);
    setTimeout(() => navigate("/feed"), 800);
  };

  const canPost = (content.trim().length > 0 || attachments.length > 0) && charLeft >= 0;

  const authorName = isAnon ? (user?.anonUsername || "Anonymous") : (user?.name || "You");
  const authorAvatar = isAnon ? null : user?.avatar;

  return (
    <>
      <div className="min-h-screen bg-white flex flex-col">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-20">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="font-bold text-gray-900 text-base">Create Quote</h1>
          <div className="flex items-center gap-2">
            {/* Anon toggle */}
            <div
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full border-2 cursor-pointer transition-all select-none ${
                isAnon
                  ? "border-gray-800 bg-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
              onClick={toggleAnon}
            >
              {isAnon ? <Shield size={13} className="text-gray-300" /> : <User size={13} />}
              <span className="text-[11px] font-bold">{isAnon ? "Anon" : "You"}</span>
            </div>
          </div>
        </div>

        {/* ── Compose area ── */}
        <div className="flex flex-1 px-4 pt-4 gap-3">
          {/* Avatar */}
          <div className="shrink-0">
            {isAnon ? (
              <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                <Shield size={18} className="text-gray-300" />
              </div>
            ) : (
              <img src={authorAvatar} alt="me" className="w-10 h-10 rounded-full object-cover" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Author name */}
            <p className="text-sm font-bold text-gray-900 mb-2">
              {authorName}
              {isAnon && <span className="ml-2 text-[10px] bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded-full">anonymous</span>}
            </p>

            {/* Text area */}
            <textarea
              ref={textRef}
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 500))}
              placeholder="What's on your mind?"
              rows={5}
              className="w-full resize-none text-gray-900 text-[15px] leading-relaxed placeholder-gray-300 focus:outline-none bg-transparent"
            />

            {/* Hashtag chips */}
            {extractedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[...new Set(extractedTags)].map((tag) => (
                  <span key={tag} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold">{tag}</span>
                ))}
              </div>
            )}

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {attachments.map((att, i) => (
                  <AttachThumb key={i} item={att} idx={i} onRemove={() => removeAttachment(i)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Bottom toolbar ── */}
        <div className={`border-t border-gray-100 px-4 py-3 sticky bottom-0 bg-white space-y-3 ${posted ? "opacity-60 pointer-events-none" : ""}`}>
          {/* Category */}
          <div className="flex overflow-x-auto gap-2 scrollbar-hide pb-1">
            {POST_CATS.map((c) => (
              <button key={c} onClick={() => setCategory(category === c ? "" : c)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  category === c
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}>
                {c}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* Attach buttons */}
            <input ref={imageRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => e.target.files && addImages(e.target.files)} />
            <input ref={videoRef} type="file" accept="video/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && addVideo(e.target.files[0])} />

            <button
              onClick={() => imageRef.current?.click()}
              disabled={attachments.length >= MAX_ATTACHMENTS}
              className="w-9 h-9 rounded-full flex items-center justify-center text-blue-500 hover:bg-blue-50 disabled:opacity-30 transition-colors"
            >
              <Image size={20} />
            </button>
            <button
              onClick={() => videoRef.current?.click()}
              disabled={attachments.length >= MAX_ATTACHMENTS}
              className="w-9 h-9 rounded-full flex items-center justify-center text-blue-500 hover:bg-blue-50 disabled:opacity-30 transition-colors"
            >
              <Video size={20} />
            </button>

            {/* Attachment count */}
            {attachments.length > 0 && (
              <span className="text-xs text-gray-400 font-semibold">{attachments.length}/{MAX_ATTACHMENTS}</span>
            )}

            {/* Allow thoughts toggle */}
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-xs text-gray-500 font-medium">Thoughts</span>
              <button onClick={() => setAllowThoughts(!allowThoughts)}
                className={`relative w-9 h-5 rounded-full transition-colors ${allowThoughts ? "bg-blue-600" : "bg-gray-300"}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${allowThoughts ? "left-4" : "left-0.5"}`} />
              </button>
            </div>

            {/* Char counter */}
            <span className={`text-xs font-semibold ml-2 ${charLeft < 20 ? "text-red-500" : "text-gray-400"}`}>
              {charLeft}
            </span>

            {/* Draft saved indicator */}
            {draftsaved && (
              <span className="text-xs text-green-500 font-medium flex items-center gap-1">
                <Check size={12} /> Saved
              </span>
            )}

            {/* Post button */}
            <button
              onClick={handlePost}
              disabled={!canPost || posting || posted}
              className={`px-5 py-2 rounded-full font-bold text-sm transition-all flex items-center gap-1.5 ${
                canPost && !posting
                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {posted ? (
                <><Check size={15} /> Posted!</>
              ) : posting ? (
                <><Loader2 size={14} className="animate-spin" /> Posting…</>
              ) : (
                "Quote it"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* PIN modal */}
      {showPinModal && (
        <AnonPinModal onSuccess={onPinSuccess} onCancel={() => setShowPinModal(false)} />
      )}
    </>
  );
}

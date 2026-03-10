import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft, Image, Video, X, Shield, User, Hash,
  ChevronDown, Loader2, Check,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

/* ── Anon PIN Modal ────────────────────────────────────────────────────────── */
function AnonPinModal({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [pin, setPin]       = useState("");
  const [error, setError]   = useState("");
  const [shaking, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  useEffect(() => {
    if (!locked) return;
    const iv = setInterval(() => {
      setLockTimer(t => { if (t <= 1) { setLocked(false); clearInterval(iv); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(iv);
  }, [locked]);

  const handlePin = (newPin: string) => {
    if (locked) return;
    setPin(newPin); setError("");
    if (newPin.length === 4) {
      if (newPin === "1234") { onSuccess(); return; }
      const na = attempts + 1;
      setAttempts(na); setShake(true);
      setError(na >= 5 ? "Too many attempts" : `Incorrect PIN — ${5 - na} attempts left`);
      setTimeout(() => { setShake(false); setPin(""); }, 500);
      if (na >= 5) { setLocked(true); setLockTimer(1800); }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-sm mx-auto bg-white rounded-t-3xl lg:rounded-3xl p-6 shadow-2xl sheet-up">
        <div className="flex justify-center mb-1">
          <div className="w-12 h-12 rounded-2xl bg-gray-900 flex items-center justify-center">
            <Shield size={22} className="text-gray-300" />
          </div>
        </div>
        <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Anonymous Mode</h3>
        <p className="text-sm text-gray-500 text-center mb-5">Enter your 4-digit PIN to post anonymously</p>
        <div className={`flex gap-3 justify-center mb-4 ${shaking ? "pin-shake" : ""}`}>
          {[0,1,2,3].map(i => (
            <div key={i} className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-all ${
              pin.length > i ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-transparent"
            }`}>
              {pin.length > i ? "•" : "0"}
            </div>
          ))}
        </div>
        {error && <p className="text-center text-xs text-red-500 font-medium mb-3">{error}</p>}
        {locked && <p className="text-center text-xs text-orange-500 font-bold mb-3">Try again in {lockTimer}s</p>}
        <input ref={inputRef} type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={4}
          value={pin} onChange={e => handlePin(e.target.value.replace(/\D/g,""))}
          className="absolute opacity-0 w-0 h-0" readOnly={locked} />
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i) => (
            <button key={i} disabled={locked || typeof k === "string" && k === ""}
              onClick={() => {
                if (k === "⌫") handlePin(pin.slice(0,-1));
                else if (k !== "") handlePin(pin + String(k));
              }}
              className={`h-12 rounded-xl text-lg font-bold transition-all ${
                k === "" ? "pointer-events-none" :
                k === "⌫" ? "bg-gray-100 text-gray-600 active:bg-gray-200" :
                "bg-gray-50 text-gray-900 hover:bg-gray-100 active:bg-gray-200"
              } ${locked ? "opacity-40" : ""}`}>
              {k}
            </button>
          ))}
        </div>
        <button onClick={onCancel} className="mt-4 w-full py-2.5 text-sm text-gray-500 font-semibold">Cancel</button>
      </div>
    </div>
  );
}

/* ── Attachment thumbnail ─────────────────────────────────────────────────── */
function AttachThumb({ item, idx, onRemove }: { item: { type: string; url: string }; idx: number; onRemove: () => void }) {
  return (
    <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 shrink-0">
      {item.type === "video" ? (
        <video src={item.url} className="w-full h-full object-cover" />
      ) : (
        <img src={item.url} alt="" className="w-full h-full object-cover" />
      )}
      <button onClick={onRemove}
        className="absolute -top-1 -right-1 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center hover:bg-red-500 transition-colors z-10">
        <X size={10} className="text-white" />
      </button>
    </div>
  );
}

/* ── Categories ── */
const POST_CATS = [
  { id: "top",           label: "🔥 Top" },
  { id: "city",          label: "🏙️ City" },
  { id: "sports",        label: "🏏 Sports" },
  { id: "science",       label: "🔬 Science" },
  { id: "entertainment", label: "🎬 Entertainment" },
  { id: "world",         label: "🌍 World" },
];

/* ════════════════════════════════════════════════════════════════════════════ */
export function CreatePostPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [isAnon, setIsAnon]       = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinVerified, setPinVerified]  = useState(false);
  const [content, setContent]     = useState("");
  const [category, setCategory]   = useState("top");
  const [attachments, setAttachments] = useState<Array<{type:"image"|"video"; url: string; file: File}>>([]);
  const [posting, setPosting]     = useState(false);
  const [posted, setPosted]       = useState(false);
  const [error, setError]         = useState("");
  const [draftSaved, setDraftSaved] = useState(false);
  const textRef  = useRef<HTMLTextAreaElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout>>();

  const charLeft = 500 - content.length;
  const canPost  = (content.trim().length > 0 || attachments.length > 0) && charLeft >= 0;

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

  /* ── Restore draft ── */
  useEffect(() => {
    const raw = localStorage.getItem("sphere_draft");
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (Date.now() - d.ts < 86400000) { setContent(d.content || ""); setCategory(d.category || "top"); }
      } catch {}
    }
    textRef.current?.focus();
  }, []);

  /* ── Toggle anon ── */
  const toggleAnon = () => {
    if (!isAnon) { if (!pinVerified) { setShowPinModal(true); return; } setIsAnon(true); }
    else setIsAnon(false);
  };

  /* ── File handlers ── */
  const addImages = (files: FileList) => {
    const remaining = 10 - attachments.length;
    Array.from(files).slice(0, remaining).forEach(file => {
      if (!file.type.startsWith("image/")) return;
      if (file.size > 10 * 1024 * 1024) { alert(`${file.name} exceeds 10MB`); return; }
      setAttachments(prev => [...prev, { type: "image", url: URL.createObjectURL(file), file }]);
    });
  };

  const addVideo = (file: File) => {
    if (!file.type.startsWith("video/")) return;
    if (file.size > 500 * 1024 * 1024) { alert("Video exceeds 500MB"); return; }
    const url = URL.createObjectURL(file);
    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.onloadedmetadata = () => {
      if (vid.duration > 1200) { alert("Video must be under 20 minutes"); URL.revokeObjectURL(url); return; }
      setAttachments(prev => [...prev, { type: "video", url, file }]);
    };
    vid.src = url;
  };

  const removeAttachment = (idx: number) => {
    setAttachments(prev => { URL.revokeObjectURL(prev[idx].url); return prev.filter((_, i) => i !== idx); });
  };

  /* ── Upload a single file to Supabase Storage ── */
  const uploadFile = async (file: File, postId: string, idx: number): Promise<string | null> => {
    const ext  = file.name.split(".").pop() || "bin";
    const path = `${user!.id}/${postId}/${idx}.${ext}`;
    const { error } = await supabase.storage.from("posts").upload(path, file, { upsert: true });
    if (error) { console.error("Upload error:", error); return null; }
    const { data } = supabase.storage.from("posts").getPublicUrl(path);
    return data.publicUrl;
  };

  /* ── Submit post to Supabase ── */
  const handlePost = async () => {
    if (!canPost || !user?.id) return;
    setPosting(true);
    setError("");

    try {
      // Extract hashtags from content
      const hashtags = [...new Set([...content.matchAll(/#(\w+)/gu)].map(m => m[1].toLowerCase()))];

      // Insert the post row first (to get its ID for media paths)
      const { data: postRow, error: postErr } = await supabase
        .from("posts")
        .insert({
          user_id:   user.id,
          body:      content.trim(),
          category:  category || "top",
          is_anon:   isAnon,
          hashtags:  hashtags,
          is_forward: false,
        })
        .select("id")
        .single();

      if (postErr || !postRow) {
        console.error("Post insert error:", postErr);
        setError("Failed to create post. Please try again.");
        setPosting(false);
        return;
      }

      const postId = postRow.id;

      // Upload media attachments
      if (attachments.length > 0) {
        const uploadPromises = attachments.map((att, idx) => uploadFile(att.file, postId, idx));
        const urls = await Promise.all(uploadPromises);

        const mediaRows = urls
          .map((url, idx) => url ? {
            post_id:    postId,
            url:        url,
            media_type: attachments[idx].type,
            position:   idx,
          } : null)
          .filter(Boolean);

        if (mediaRows.length > 0) {
          await supabase.from("post_media").insert(mediaRows);
        }
      }

      // Done!
      localStorage.removeItem("sphere_draft");
      setPosted(true);
      setTimeout(() => navigate("/feed"), 800);

    } catch (err) {
      console.error("Unexpected error:", err);
      setError("Something went wrong. Please try again.");
      setPosting(false);
    }
  };

  const extractedTags = [...content.matchAll(/#(\w+)/gu)].map(m => m[0]);
  const displayName   = isAnon ? (profile?.username ? `@anon_${profile.username}` : "Anonymous") : (profile?.name || "You");
  const displayAvatar = isAnon ? null : profile?.avatar_url;

  return (
    <>
      <div className="min-h-screen bg-white flex flex-col">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-20">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-gray-900 text-base">Create Quote</h1>
            {draftSaved && <span className="text-xs text-gray-400">Draft saved</span>}
          </div>
          <div
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full border-2 cursor-pointer transition-all select-none ${
              isAnon ? "border-gray-800 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            }`}
            onClick={toggleAnon}
          >
            {isAnon ? <Shield size={13} className="text-gray-300" /> : <User size={13} />}
            <span className="text-[11px] font-bold">{isAnon ? "Anon" : "You"}</span>
          </div>
        </div>

        {/* ── Compose area ── */}
        <div className="flex flex-1 px-4 pt-4 gap-3">
          <div className="shrink-0">
            {isAnon ? (
              <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                <Shield size={18} className="text-gray-300" />
              </div>
            ) : displayAvatar ? (
              <img src={displayAvatar} alt="me" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                {displayName?.[0]?.toUpperCase() || "U"}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 mb-2">
              {displayName}
              {isAnon && <span className="ml-2 text-[10px] bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded-full">anonymous</span>}
            </p>

            <textarea
              ref={textRef}
              value={content}
              onChange={e => setContent(e.target.value.slice(0, 500))}
              placeholder="What's on your mind?"
              rows={5}
              className="w-full resize-none text-gray-900 text-[15px] leading-relaxed placeholder-gray-300 focus:outline-none bg-transparent"
            />

            {extractedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[...new Set(extractedTags)].map(tag => (
                  <span key={tag} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold">{tag}</span>
                ))}
              </div>
            )}

            {attachments.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {attachments.map((att, i) => (
                  <AttachThumb key={i} item={att} idx={i} onRemove={() => removeAttachment(i)} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1" />

        {/* ── Error message ── */}
        {error && (
          <div className="mx-4 mb-2 px-4 py-2 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        {/* ── Bottom toolbar ── */}
        <div className={`border-t border-gray-100 px-4 py-3 sticky bottom-0 bg-white space-y-3 ${posted ? "opacity-60 pointer-events-none" : ""}`}>
          {/* Category */}
          <div className="flex overflow-x-auto gap-2 scrollbar-hide pb-1">
            {POST_CATS.map(c => (
              <button key={c.id} onClick={() => setCategory(c.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                  category === c.id
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}>
                {c.label}
              </button>
            ))}
          </div>

          {/* Media + char count + post button */}
          <div className="flex items-center gap-3">
            {/* Image */}
            <button onClick={() => imageRef.current?.click()}
              disabled={attachments.length >= 10}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 disabled:opacity-40 transition-colors">
              <Image size={18} className="text-gray-500" />
            </button>
            <input ref={imageRef} type="file" accept="image/*" multiple hidden
              onChange={e => e.target.files && addImages(e.target.files)} />

            {/* Video */}
            <button onClick={() => videoRef.current?.click()}
              disabled={attachments.length >= 10}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 disabled:opacity-40 transition-colors">
              <Video size={18} className="text-gray-500" />
            </button>
            <input ref={videoRef} type="file" accept="video/*" hidden
              onChange={e => e.target.files?.[0] && addVideo(e.target.files[0])} />

            <div className="flex-1" />

            {/* Char counter */}
            <div className={`text-xs font-bold tabular-nums ${charLeft < 0 ? "text-red-500" : charLeft < 50 ? "text-amber-500" : "text-gray-300"}`}>
              {charLeft}
            </div>

            {/* Post button */}
            <button
              onClick={handlePost}
              disabled={!canPost || posting || posted}
              className={`px-5 py-2 rounded-full font-bold text-sm transition-all ${
                canPost && !posting && !posted
                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/20"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {posted ? (
                <span className="flex items-center gap-1.5"><Check size={14} />Posted!</span>
              ) : posting ? (
                <span className="flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" />Posting…</span>
              ) : (
                "Post"
              )}
            </button>
          </div>
        </div>
      </div>

      {showPinModal && (
        <AnonPinModal
          onSuccess={() => { setShowPinModal(false); setPinVerified(true); setIsAnon(true); }}
          onCancel={() => setShowPinModal(false)}
        />
      )}
    </>
  );
}

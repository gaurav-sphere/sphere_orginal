import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  ArrowLeft, ImagePlus, Video, X, Shield, User,
  Loader2, Check, MessageSquareOff, BarChart2,
  FileText, Hash, AtSign, Plus, Trash2, ChevronDown,
  Clock, AlertCircle,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase, verifyAnonPin } from "../lib/supabase";
import { fetchPostById, type LivePost } from "../services/feedService";
import { AppShell } from "../components/AppShell";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
   NOTE: CHAR_LIMIT is 500 because the DB has a hard constraint:
   CHECK (char_length(body) <= 500). Increasing this requires
   running: ALTER TABLE posts DROP CONSTRAINT posts_body_check;
   ALTER TABLE posts ADD CONSTRAINT posts_body_check
   CHECK (char_length(body) <= 750);
   Ask your DB admin before changing CHAR_LIMIT here.
══════════════════════════════════════════════════════════════ */
const CHAR_LIMIT    = 500;
const CIRCLE_R      = 16;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R; // ≈ 100.5

/* ── Valid DB category values ── */
const VALID_CATEGORIES = [
  "top","city","sports","science","entertainment",
  "world","tech","politics","music","food","other",
] as const;
type Category = typeof VALID_CATEGORIES[number];

/* ── Category display labels ── */
const CAT_LABELS: Record<Category, string> = {
  top: "🔥 Top", city: "🏙️ City", sports: "🏏 Sports",
  science: "🔬 Science", entertainment: "🎬 Entertainment",
  world: "🌍 World", tech: "💻 Tech", politics: "🗳️ Politics",
  music: "🎵 Music", food: "🍽️ Food", other: "💬 Other",
};

/* ── Auto-detect category from content keywords ── */
const DETECT_KEYWORDS: Record<Category, string[]> = {
  sports:        ["cricket","ipl","football","hockey","tennis","match","score","goal","league","player","game","stadium","wicket","goal","bcci","fifa"],
  entertainment: ["movie","film","bollywood","hollywood","celebrity","actor","actress","show","series","ott","netflix","amazon","hotstar"],
  tech:          ["tech","coding","software","app","startup","programming","javascript","python","ai","chatgpt","openai","github","developer"],
  science:       ["science","isro","nasa","research","space","biology","physics","chemistry","experiment","satellite","rocket"],
  politics:      ["politics","election","government","parliament","vote","minister","bjp","congress","cm","pm","party","rally"],
  music:         ["music","song","album","singer","concert","rap","beats","playlist","spotify","artist","lyrics"],
  food:          ["food","recipe","restaurant","eat","biryani","pizza","coffee","dinner","lunch","breakfast","chef"],
  city:          ["city","mumbai","delhi","bangalore","chennai","kolkata","hyderabad","pune","local","traffic","metro"],
  world:         ["global","international","war","peace","usa","uk","china","russia","un","nato","treaty","g20"],
  top:           [], other: [],
};

function autoDetectCategory(text: string): Category {
  const lower = text.toLowerCase();
  let best: Category = "top";
  let bestScore = 0;
  for (const [cat, keywords] of Object.entries(DETECT_KEYWORDS)) {
    if (!keywords.length) continue;
    const score = keywords.filter(kw => lower.includes(kw)).length;
    if (score > bestScore) { bestScore = score; best = cat as Category; }
  }
  return best;
}

/* ── Image compression using canvas ── */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 300_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const MAX = 1920;
    const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width  = Math.round(bitmap.width  * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return new Promise(resolve => {
      canvas.toBlob(blob => {
        if (blob && blob.size < file.size) {
          resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
        } else {
          resolve(file);
        }
      }, "image/jpeg", 0.82);
    });
  } catch {
    return file;
  }
}

/* ── Types ── */
interface AttachItem { type: "image" | "video"; url: string; file: File }
interface Draft {
  id: string; content: string; category: Category; isAnon: boolean;
  pollOptions: string[]; pollDuration: number; createdAt: number; updatedAt: number;
}

/* ── Draft helpers ── */
const DRAFT_KEY = "sphere_drafts_v2";
function loadDrafts(): Draft[] {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "[]"); } catch { return []; }
}
function saveDrafts(drafts: Draft[]) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
}
function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ══════════════════════════════════════════════════════════════
   ANON PIN MODAL — uses real verifyAnonPin() edge function
══════════════════════════════════════════════════════════════ */
function AnonPinModal({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [pin, setPin]         = useState("");
  const [error, setError]     = useState("");
  const [shaking, setShake]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [locked, setLocked]   = useState(false);
  const [lockSecs, setLockSecs] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  useEffect(() => {
    if (!locked) return;
    const iv = setInterval(() => {
      setLockSecs(s => { if (s <= 1) { setLocked(false); clearInterval(iv); return 0; } return s - 1; });
    }, 1000);
    return () => clearInterval(iv);
  }, [locked]);

  const handlePin = async (newPin: string) => {
    if (locked || loading) return;
    setPin(newPin);
    setError("");
    if (newPin.length === 4) {
      setLoading(true);
      try {
        const result = await verifyAnonPin(newPin);
        setLoading(false);
        if (result.success) { onSuccess(); return; }
        if (result.locked) {
          setLocked(true); setLockSecs(1800);
          setError("Too many attempts. Locked for 30 min.");
        } else {
          setShake(true);
          setError(`Incorrect PIN — ${result.attempts_left} attempts left`);
          setTimeout(() => { setShake(false); setPin(""); }, 500);
        }
      } catch {
        setLoading(false);
        setShake(true);
        setError("Verification failed. Try again.");
        setTimeout(() => { setShake(false); setPin(""); }, 500);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative w-full max-w-sm mx-auto bg-white dark:bg-gray-900 rounded-t-3xl lg:rounded-3xl p-6 shadow-2xl">
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-2xl bg-gray-900 dark:bg-gray-700 flex items-center justify-center">
            <Shield size={22} className="text-gray-200" />
          </div>
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-1">Anonymous Mode</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-5">Enter your 4-digit PIN</p>

        <div className={`flex gap-3 justify-center mb-4 ${shaking ? "animate-[shake_0.3s_ease]" : ""}`}>
          {[0,1,2,3].map(i => (
            <div key={i} className={`w-13 h-13 w-12 h-12 rounded-xl border-2 flex items-center justify-center text-lg font-bold transition-all ${
              pin.length > i ? "border-gray-900 dark:border-gray-300 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900" : "border-gray-200 dark:border-gray-600"
            }`}>
              {pin.length > i ? "•" : ""}
            </div>
          ))}
        </div>

        {loading && <div className="flex justify-center mb-3"><Loader2 size={18} className="animate-spin text-blue-500" /></div>}
        {error && <p className="text-center text-xs text-red-500 font-medium mb-3">{error}</p>}
        {locked && <p className="text-center text-xs text-orange-500 font-bold mb-3">Try again in {lockSecs}s</p>}

        <input ref={inputRef} type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={4}
          value={pin} onChange={e => handlePin(e.target.value.replace(/\D/g, ""))}
          className="absolute opacity-0 w-0 h-0" readOnly={locked || loading} />

        <div className="grid grid-cols-3 gap-2.5">
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k, i) => (
            <button key={i} disabled={locked || loading || (typeof k === "string" && k === "")}
              onClick={() => {
                if (k === "⌫") handlePin(pin.slice(0, -1));
                else if (k !== "") handlePin(pin + String(k));
              }}
              className={`h-12 rounded-xl text-lg font-bold transition-all ${
                k === "" ? "pointer-events-none" :
                k === "⌫" ? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300" :
                "bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95"
              } ${locked || loading ? "opacity-40" : ""}`}>
              {k}
            </button>
          ))}
        </div>
        <button onClick={onCancel} className="mt-4 w-full py-2.5 text-sm text-gray-500 dark:text-gray-400 font-semibold hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CHAR COUNTER — SVG circle like Twitter/X
══════════════════════════════════════════════════════════════ */
function CharCounter({ chars, limit }: { chars: number; limit: number }) {
  const progress    = Math.min(chars / limit, 1.3);
  const dashOffset  = CIRCUMFERENCE * (1 - Math.min(progress, 1));
  const isOver      = chars > limit;
  const isWarning   = chars >= limit * 0.85;
  const remaining   = limit - chars;
  const strokeColor = isOver ? "#ef4444" : isWarning ? "#f59e0b" : "#3b82f6";

  return (
    <div className="relative w-9 h-9 flex items-center justify-center shrink-0">
      <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
        {/* Track */}
        <circle cx="18" cy="18" r={CIRCLE_R} fill="none" stroke="#e5e7eb"
          className="dark:stroke-gray-700" strokeWidth="2.5" />
        {/* Progress */}
        <circle cx="18" cy="18" r={CIRCLE_R} fill="none"
          stroke={strokeColor} strokeWidth="2.5"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.1s linear, stroke 0.2s" }}
        />
      </svg>
      {/* Show number only when ≤ 60 remaining */}
      {(isOver || remaining <= 60) && (
        <span className={`absolute text-[10px] font-bold tabular-nums ${
          isOver ? "text-red-500" : isWarning ? "text-amber-500" : "text-gray-600 dark:text-gray-300"
        }`}>
          {isOver ? `-${Math.abs(remaining)}` : remaining}
        </span>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SMART MEDIA GRID
══════════════════════════════════════════════════════════════ */
function MediaGrid({ items, onRemove }: { items: AttachItem[]; onRemove: (i: number) => void }) {
  if (!items.length) return null;

  const renderItem = (item: AttachItem, idx: number, extraClass = "") => (
    <div key={idx} className={`relative overflow-hidden bg-gray-900 ${extraClass}`}>
      {item.type === "video" ? (
        <video src={item.url} className="w-full h-full object-cover" />
      ) : (
        <img src={item.url} alt="" className="w-full h-full object-cover" />
      )}
      <button onClick={() => onRemove(idx)}
        className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors z-10">
        <X size={12} className="text-white" />
      </button>
      {item.type === "video" && (
        <div className="absolute bottom-1.5 left-1.5 bg-black/60 rounded-full px-1.5 py-0.5 text-[10px] text-white font-bold">▶ Video</div>
      )}
    </div>
  );

  if (items.length === 1) {
    return <div className="mt-3 rounded-xl overflow-hidden max-h-64">{renderItem(items[0], 0, "w-full h-64")}</div>;
  }
  if (items.length === 2) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-0.5 rounded-xl overflow-hidden h-48">
        {items.map((item, i) => renderItem(item, i, "h-full"))}
      </div>
    );
  }
  if (items.length === 3) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-0.5 rounded-xl overflow-hidden h-48">
        {renderItem(items[0], 0, "h-full")}
        <div className="grid grid-rows-2 gap-0.5 h-48">
          {renderItem(items[1], 1, "h-full")}
          {renderItem(items[2], 2, "h-full")}
        </div>
      </div>
    );
  }
  // 4+
  return (
    <div className="mt-3 grid grid-cols-2 gap-0.5 rounded-xl overflow-hidden">
      {items.slice(0, 4).map((item, i) => (
        <div key={i} className="relative h-28 overflow-hidden bg-gray-900">
          {item.type === "video"
            ? <video src={item.url} className="w-full h-full object-cover" />
            : <img src={item.url} alt="" className="w-full h-full object-cover" />}
          <button onClick={() => onRemove(i)}
            className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors z-10">
            <X size={10} className="text-white" />
          </button>
          {i === 3 && items.length > 4 && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white font-bold text-xl">+{items.length - 4}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   HASHTAG PILL — truncated for long tags
══════════════════════════════════════════════════════════════ */
function HashtagPill({ tag }: { tag: string }) {
  const display = tag.length > 16 ? tag.slice(0, 15) + "…" : tag;
  return (
    <span title={tag}
      className="inline-flex items-center gap-0.5 text-xs bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-semibold max-w-[120px] shrink-0">
      <Hash size={10} className="shrink-0" />
      <span className="truncate">{display.replace(/^#/, "")}</span>
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   REQUOTE EMBED — compact preview of the original post
══════════════════════════════════════════════════════════════ */
function RequoteEmbed({ post }: { post: LivePost }) {
  const [imgErr, setImgErr] = useState(false);
  const firstImage = post.mediaItems?.find(m => m.type === "image")?.url;

  return (
    <div className="mt-3 border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-gray-50 dark:bg-gray-800/50">
      <div className="flex items-center gap-2 mb-1.5">
        {post.user.avatar && !imgErr ? (
          <img src={post.user.avatar} alt={post.user.name} onError={() => setImgErr(true)}
            className="w-5 h-5 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
            <span className="text-white text-[8px] font-bold">{post.user.name[0]}</span>
          </div>
        )}
        <span className="text-xs font-bold text-gray-900 dark:text-white truncate">{post.user.name}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500 truncate shrink-0">· {post.timestamp}</span>
      </div>
      <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 leading-relaxed">{post.body}</p>
      {firstImage && (
        <img src={firstImage} alt="" className="mt-1.5 rounded-lg w-full max-h-20 object-cover" />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   POLL EDITOR
══════════════════════════════════════════════════════════════ */
function PollEditor({
  options, setOptions, duration, setDuration,
}: {
  options: string[]; setOptions: (o: string[]) => void;
  duration: number; setDuration: (d: number) => void;
}) {
  const DURATIONS = [
    { label: "24 hours", value: 24 },
    { label: "3 days",   value: 72 },
    { label: "7 days",   value: 168 },
  ];

  const update = (idx: number, val: string) => {
    const next = [...options];
    next[idx] = val.slice(0, 60);
    setOptions(next);
  };

  return (
    <div className="mt-3 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <div className="bg-blue-50 dark:bg-blue-950/30 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BarChart2 size={14} className="text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Poll</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={11} className="text-gray-400" />
          <select value={duration} onChange={e => setDuration(Number(e.target.value))}
            className="text-xs text-gray-600 dark:text-gray-300 bg-transparent font-medium focus:outline-none cursor-pointer">
            {DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
      </div>
      <div className="p-3 space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 shrink-0 flex items-center justify-center">
              <span className="text-[9px] font-bold text-gray-400">{i+1}</span>
            </div>
            <input value={opt} onChange={e => update(i, e.target.value)}
              placeholder={`Option ${i + 1}${i < 2 ? " *" : ""}`}
              className="flex-1 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-400" />
            {i >= 2 && (
              <button onClick={() => setOptions(options.filter((_, j) => j !== i))}
                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {options.length < 4 && (
          <button onClick={() => setOptions([...options, ""])}
            className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700 dark:hover:text-blue-300 transition-colors mt-1">
            <Plus size={13} /> Add option
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   AUTOCOMPLETE DROPDOWN — for # and @
══════════════════════════════════════════════════════════════ */
interface Suggestion {
  type: "hashtag" | "mention";
  value: string;
  label: string;
  sublabel?: string;
  avatar?: string | null;
}

function AutocompleteDropdown({
  suggestions, onSelect, loading,
}: {
  suggestions: Suggestion[];
  onSelect:    (s: Suggestion) => void;
  loading:     boolean;
}) {
  if (!suggestions.length && !loading) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
      {loading ? (
        <div className="px-4 py-3 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={12} className="animate-spin" /> Searching…
        </div>
      ) : (
        suggestions.map((s, i) => (
          <button key={i} onClick={() => onSelect(s)}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
            {s.type === "mention" ? (
              s.avatar ? (
                <img src={s.avatar} alt={s.label} className="w-7 h-7 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">{s.label[0]}</span>
                </div>
              )
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
                <Hash size={13} className="text-blue-600 dark:text-blue-400" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{s.label}</p>
              {s.sublabel && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{s.sublabel}</p>}
            </div>
          </button>
        ))
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DRAFT PANEL — desktop right column
══════════════════════════════════════════════════════════════ */
function DraftPanel({
  drafts, onLoad, onDelete,
}: {
  drafts: Draft[];
  onLoad:   (d: Draft) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <aside className="hidden lg:flex flex-col w-72 shrink-0 border-l border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 overflow-y-auto">
      <div className="sticky top-0 bg-gray-50 dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-gray-500 dark:text-gray-400" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Drafts</h3>
          {drafts.length > 0 && (
            <span className="ml-auto text-xs text-gray-400">{drafts.length} saved</span>
          )}
        </div>
      </div>

      {drafts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
          <FileText size={28} className="text-gray-200 dark:text-gray-700 mb-3" />
          <p className="text-xs text-gray-400 dark:text-gray-600">
            Drafts auto-save as you type. They'll appear here.
          </p>
        </div>
      ) : (
        <div className="p-3 space-y-2">
          {drafts.map(d => (
            <div key={d.id}
              className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-3 group">
              <p className="text-xs text-gray-800 dark:text-gray-200 line-clamp-3 leading-relaxed mb-2">
                {d.content || <span className="text-gray-400 italic">No text</span>}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400 dark:text-gray-600">{timeAgo(d.updatedAt)}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onDelete(d.id)}
                    className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 dark:text-gray-700 dark:hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                  </button>
                  <button onClick={() => onLoad(d)}
                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors px-2 py-0.5 bg-blue-50 dark:bg-blue-950/50 rounded-full">
                    Load
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

/* ══════════════════════════════════════════════════════════════
   DRAFT SHEET — mobile bottom drawer
══════════════════════════════════════════════════════════════ */
function DraftSheet({
  drafts, onLoad, onDelete, onClose,
}: {
  drafts: Draft[];
  onLoad:   (d: Draft) => void;
  onDelete: (id: string) => void;
  onClose:  () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-white dark:bg-gray-900 rounded-t-2xl max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-gray-500" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Drafts</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-3">
          {drafts.length === 0 ? (
            <div className="text-center py-10">
              <FileText size={24} className="text-gray-200 dark:text-gray-700 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No drafts yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {drafts.map(d => (
                <div key={d.id} className="border border-gray-100 dark:border-gray-800 rounded-xl p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{d.content || <span className="italic text-gray-400">No text</span>}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(d.updatedAt)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => onDelete(d.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                    <button onClick={() => { onLoad(d); onClose(); }}
                      className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400 px-2.5 py-1 rounded-full">
                      Load
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CREATE POST PAGE — MAIN
══════════════════════════════════════════════════════════════ */
export function CreatePostPage() {
  const navigate           = useNavigate();
  const [searchParams]     = useSearchParams();
  const { user, profile }  = useAuth();
  const requoteId          = searchParams.get("requote");

  /* ── Core state ── */
  const [content,      setContent]      = useState("");
  const [isAnon,       setIsAnon]       = useState(false);
  const [pinVerified,  setPinVerified]  = useState(false);
  const [commentsOff,  setCommentsOff]  = useState(false);
  const [attachments,  setAttachments]  = useState<AttachItem[]>([]);
  const [category,     setCategory]     = useState<Category>("top"); // auto-detected, hidden
  const [posting,      setPosting]      = useState(false);
  const [posted,       setPosted]       = useState(false);
  const [error,        setError]        = useState("");
  const [draftSaved,   setDraftSaved]   = useState(false);

  /* ── Requote state ── */
  const [requotePost,  setRequotePost]  = useState<LivePost | null>(null);
  const [requoteLoading, setRequoteLoading] = useState(false);

  /* ── Poll state ── */
  const [showPoll,     setShowPoll]     = useState(false);
  const [pollOptions,  setPollOptions]  = useState(["", ""]);
  const [pollDuration, setPollDuration] = useState(24);

  /* ── Modal/sheet state ── */
  const [showPinModal,   setShowPinModal]   = useState(false);
  const [showDraftSheet, setShowDraftSheet] = useState(false);
  const [drafts,         setDrafts]         = useState<Draft[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);

  /* ── Autocomplete state ── */
  const [suggestions,    setSuggestions]    = useState<Suggestion[]>([]);
  const [acLoading,      setAcLoading]      = useState(false);
  const [acTrigger,      setAcTrigger]      = useState<{ type: "hashtag" | "mention"; word: string; start: number } | null>(null);

  /* ── Refs ── */
  const textRef    = useRef<HTMLTextAreaElement>(null);
  const imageRef   = useRef<HTMLInputElement>(null);
  const videoRef   = useRef<HTMLInputElement>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout>>();
  const acTimer    = useRef<ReturnType<typeof setTimeout>>();

  const charCount = content.length;
  const canPost   = (content.trim().length > 0 || attachments.length > 0)
    && charCount <= CHAR_LIMIT
    && !posting && !posted;

  /* ── Load requote post ── */
  useEffect(() => {
    if (!requoteId) return;
    setRequoteLoading(true);
    fetchPostById(requoteId, user?.id)
      .then(post => { setRequotePost(post); setRequoteLoading(false); })
      .catch(() => setRequoteLoading(false));
  }, [requoteId, user?.id]);

  /* ── Load drafts ── */
  useEffect(() => {
    setDrafts(loadDrafts().filter(d => Date.now() - d.updatedAt < 86_400_000));
    setTimeout(() => textRef.current?.focus(), 150);
  }, []);

  /* ── Auto-detect category ── */
  useEffect(() => {
    if (!content.trim()) return;
    const detected = autoDetectCategory(content);
    setCategory(detected);
  }, [content]);

  /* ── Auto-save draft (2s debounce) ── */
  useEffect(() => {
    if (!content.trim() && attachments.length === 0) return;
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      const all = loadDrafts();
      const now = Date.now();
      const id  = currentDraftId || `draft_${now}`;
      const newDraft: Draft = {
        id, content, category, isAnon,
        pollOptions, pollDuration,
        createdAt: currentDraftId ? (all.find(d => d.id === id)?.createdAt ?? now) : now,
        updatedAt: now,
      };
      const updated = [newDraft, ...all.filter(d => d.id !== id)].slice(0, 10);
      saveDrafts(updated);
      setDrafts(updated);
      if (!currentDraftId) setCurrentDraftId(id);
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 1500);
    }, 2000);
    return () => clearTimeout(draftTimer.current);
  }, [content, isAnon, category, pollOptions, pollDuration]);

  /* ── Autocomplete detection ── */
  const handleContentChange = (val: string) => {
    setContent(val.slice(0, CHAR_LIMIT + 20)); // allow slight overflow for display

    // Detect trigger at cursor
    const el   = textRef.current;
    if (!el) return;
    const pos  = el.selectionStart ?? val.length;
    const left = val.slice(0, pos);
    const hashMatch  = left.match(/#([\w\u0900-\u097F]*)$/);
    const mentionMatch = left.match(/@([\w]*)$/);

    if (hashMatch) {
      const word = hashMatch[1];
      setAcTrigger({ type: "hashtag", word, start: pos - hashMatch[0].length });
      fetchHashtagSuggestions(word);
    } else if (mentionMatch) {
      const word = mentionMatch[1];
      setAcTrigger({ type: "mention", word, start: pos - mentionMatch[0].length });
      fetchMentionSuggestions(word);
    } else {
      setAcTrigger(null);
      setSuggestions([]);
    }
  };

  const fetchHashtagSuggestions = (word: string) => {
    clearTimeout(acTimer.current);
    if (!word) { setSuggestions([]); return; }
    setAcLoading(true);
    acTimer.current = setTimeout(async () => {
      const { data } = await supabase.from("hashtag_stats")
        .select("tag, posts_count")
        .ilike("tag", `${word}%`)
        .order("posts_count", { ascending: false })
        .limit(5);
      setSuggestions((data || []).map((r: any) => ({
        type: "hashtag", value: r.tag, label: `#${r.tag}`,
        sublabel: `${r.posts_count} posts`,
      })));
      setAcLoading(false);
    }, 250);
  };

  const fetchMentionSuggestions = (word: string) => {
    clearTimeout(acTimer.current);
    if (!word) { setSuggestions([]); return; }
    setAcLoading(true);
    acTimer.current = setTimeout(async () => {
      const { data } = await supabase.from("profiles")
        .select("id, name, username, avatar_url")
        .ilike("username", `${word}%`)
        .limit(5);
      setSuggestions((data || []).map((r: any) => ({
        type: "mention", value: r.username, label: r.name,
        sublabel: `@${r.username}`, avatar: r.avatar_url,
      })));
      setAcLoading(false);
    }, 250);
  };

  const applyAutocomplete = (s: Suggestion) => {
    if (!acTrigger || !textRef.current) return;
    const el    = textRef.current;
    const pos   = el.selectionStart ?? content.length;
    const left  = content.slice(0, acTrigger.start);
    const right = content.slice(pos);
    const insert = s.type === "hashtag" ? `#${s.value} ` : `@${s.value} `;
    const newContent = left + insert + right;
    setContent(newContent.slice(0, CHAR_LIMIT + 20));
    setAcTrigger(null);
    setSuggestions([]);
    setTimeout(() => {
      el.focus();
      const newPos = (left + insert).length;
      el.setSelectionRange(newPos, newPos);
    }, 0);
  };

  /* ── Anon toggle ── */
  const toggleAnon = () => {
    if (!isAnon) {
      if (!profile?.anon_pin_set) {
        // PIN not created yet — go to create PIN page
        navigate("/settings/anon-pin?mode=create&from=create-post");
        return;
      }
      if (!pinVerified) { setShowPinModal(true); return; }
      setIsAnon(true);
    } else {
      setIsAnon(false);
    }
  };

  /* ── File handlers ── */
  const addImages = async (files: FileList) => {
    const remaining = 10 - attachments.length;
    const toAdd = Array.from(files).slice(0, remaining);
    for (const file of toAdd) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 20 * 1024 * 1024) { setError(`${file.name} exceeds 20MB`); continue; }
      const compressed = await compressImage(file);
      const url = URL.createObjectURL(compressed);
      setAttachments(prev => [...prev, { type: "image", url, file: compressed }]);
    }
    setError("");
  };

  const addVideo = (file: File) => {
    if (!file.type.startsWith("video/")) return;
    if (file.size > 200 * 1024 * 1024) { setError("Video exceeds 200MB. Please compress it first."); return; }
    const url = URL.createObjectURL(file);
    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.onloadedmetadata = () => {
      if (vid.duration > 1200) { setError("Video must be under 20 minutes"); URL.revokeObjectURL(url); return; }
      setAttachments(prev => [...prev, { type: "video", url, file }]);
      setError("");
    };
    vid.src = url;
  };

  const removeAttachment = (idx: number) => {
    setAttachments(prev => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  /* ── Upload ── */
  const uploadFile = async (file: File, postId: string, idx: number): Promise<string | null> => {
    const ext  = file.name.split(".").pop() || "bin";
    const path = `${user!.id}/${postId}/${idx}.${ext}`;
    const { error } = await supabase.storage.from("posts").upload(path, file, { upsert: true });
    if (error) { console.error("Upload error:", error); return null; }
    const { data } = supabase.storage.from("posts").getPublicUrl(path);
    return data.publicUrl;
  };

  /* ── Submit ── */
  const handlePost = async () => {
    if (!canPost || !user?.id) return;
    setPosting(true); setError("");

    try {
      /* Extract hashtags (unicode-safe) and mentions */
      const hashtagMatches = [...content.matchAll(/#([\w\u0900-\u097F\u0980-\u09FF]+)/gu)];
      const hashtags = [...new Set(hashtagMatches.map(m => m[1].toLowerCase()))];

      const mentionMatches = [...content.matchAll(/@(\w+)/gu)];
      const mentions = [...new Set(mentionMatches.map(m => m[1].toLowerCase()))];

      /* For requote: use forward fields */
      const isForward = !!requoteId;
      const bodyText  = content.trim();

      const insertData: Record<string, unknown> = {
        user_id:      user.id,
        body:         bodyText,
        category:     category,
        is_anon:      isAnon,
        hashtags:     hashtags,
        mentions:     mentions,
        comments_off: commentsOff,
        is_forward:   isForward,
      };
      if (isForward && requoteId) {
        insertData.forward_of      = requoteId;
        insertData.forward_comment = bodyText;
        // Requote body can be the comment or empty if no comment
        insertData.body = bodyText || "— forwarded";
      }

      /* Insert post */
      const { data: postRow, error: postErr } = await supabase
        .from("posts")
        .insert(insertData)
        .select("id")
        .single();

      if (postErr || !postRow) {
        console.error("Post insert error:", postErr);
        setError(postErr?.message || "Failed to create post. Please try again.");
        setPosting(false);
        return;
      }

      const postId = postRow.id;

      /* Upload media */
      if (attachments.length > 0) {
        const urls = await Promise.all(attachments.map((a, i) => uploadFile(a.file, postId, i)));
        const mediaRows = urls
          .map((url, i) => url ? {
            post_id: postId, url,
            media_type: attachments[i].type,
            position:   i,
          } : null)
          .filter(Boolean);
        if (mediaRows.length > 0) {
          await supabase.from("post_media").insert(mediaRows);
        }
      }

      /* Insert poll */
      if (showPoll) {
        const validOptions = pollOptions.filter(o => o.trim());
        if (validOptions.length >= 2) {
          await supabase.from("post_polls").insert({
            post_id:        postId,
            options:        validOptions.map(text => ({ text })),
            duration_hours: pollDuration,
            ends_at:        new Date(Date.now() + pollDuration * 3_600_000).toISOString(),
          });
        }
      }

      /* Remove current draft */
      if (currentDraftId) {
        const updated = loadDrafts().filter(d => d.id !== currentDraftId);
        saveDrafts(updated);
      } else {
        localStorage.removeItem("sphere_draft"); // clean old key too
      }

      setPosted(true);
      setTimeout(() => navigate("/feed"), 700);

    } catch (err: any) {
      console.error("Unexpected error:", err);
      setError(err?.message || "Something went wrong. Please try again.");
      setPosting(false);
    }
  };

  /* ── Draft actions ── */
  const handleLoadDraft = (d: Draft) => {
    setContent(d.content);
    setCategory(d.category);
    setIsAnon(d.isAnon);
    if (d.pollOptions?.length >= 2) { setPollOptions(d.pollOptions); setShowPoll(true); }
    setPollDuration(d.pollDuration || 24);
    setCurrentDraftId(d.id);
  };

  const handleDeleteDraft = (id: string) => {
    const updated = loadDrafts().filter(d => d.id !== id);
    saveDrafts(updated);
    setDrafts(updated);
    if (currentDraftId === id) setCurrentDraftId(null);
  };

  /* ── Detected hashtag pills (from content) ── */
  const detectedTags = [...new Set(
    [...content.matchAll(/#([\w\u0900-\u097F\u0980-\u09FF]+)/gu)].map(m => m[0])
  )].slice(0, 8);

  /* ── Display info ── */
  const [avatarErr, setAvatarErr] = useState(false);
  const displayName   = isAnon ? (profile?.anon_username ? `@${profile.anon_username}` : "Anonymous") : (profile?.name || "You");
  const displayUser   = isAnon ? null : profile?.username;
  const displayAvatar = isAnon ? null : (avatarErr ? null : profile?.avatar_url);

  /* ══════════════════════ RENDER ══════════════════════════════ */
  return (
    <AppShell>
      <div className="flex h-full bg-white dark:bg-gray-950">

        {/* ── COMPOSE COLUMN ── */}
        <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">

          {/* ── Header ── */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0 bg-white dark:bg-gray-900">
            <button onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0">
              <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
            </button>

            <h1 className="font-bold text-gray-900 dark:text-white text-base flex-1">
              {requoteId ? "Requote" : "Create Quote"}
            </h1>

            {draftSaved && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium mr-1">Saved</span>
            )}

            {/* Anon toggle */}
            <button
              onClick={toggleAnon}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border-2 text-[11px] font-bold transition-all select-none ${
                isAnon
                  ? "border-gray-800 dark:border-gray-300 bg-gray-900 dark:bg-gray-100 text-gray-200 dark:text-gray-900"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              {isAnon ? <Shield size={12} className="text-gray-300 dark:text-gray-700" /> : <User size={12} />}
              {isAnon ? "Anon" : "You"}
            </button>

            {/* Post button */}
            <button onClick={handlePost} disabled={!canPost}
              className={`px-4 py-1.5 rounded-full font-bold text-sm transition-all ${
                canPost
                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/20"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600"
              }`}
            >
              {posted ? (
                <span className="flex items-center gap-1"><Check size={13} />Done</span>
              ) : posting ? (
                <span className="flex items-center gap-1"><Loader2 size={13} className="animate-spin" />Posting</span>
              ) : (
                requoteId ? "Requote" : "Post"
              )}
            </button>
          </div>

          {/* ── Scrollable compose area ── */}
          <div className="flex-1 overflow-y-auto" ref={e => { /* scroll container */ }}>

            {/* User row */}
            <div className="flex items-start gap-3 px-4 pt-4 pb-2">
              {/* Avatar */}
              {isAnon ? (
                <div className="w-10 h-10 rounded-full bg-gray-800 dark:bg-gray-700 flex items-center justify-center shrink-0">
                  <Shield size={18} className="text-gray-300" />
                </div>
              ) : displayAvatar ? (
                <img src={displayAvatar} alt="me" onError={() => setAvatarErr(true)}
                  className="w-10 h-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0 text-white font-bold text-base">
                  {displayName[0]?.toUpperCase() || "U"}
                </div>
              )}

              {/* Name + username */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                      {displayName}
                      {isAnon && (
                        <span className="ml-2 text-[9px] bg-gray-800 dark:bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full align-middle">anon</span>
                      )}
                    </p>
                    {!isAnon && displayUser && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 leading-tight">@{displayUser}</p>
                    )}
                    {isAnon && profile?.anon_username && (
                      <p className="text-xs text-gray-500 dark:text-gray-600 leading-tight">@{profile.anon_username}</p>
                    )}
                  </div>

                  {/* Draft button — mobile only (desktop uses panel) */}
                  <button onClick={() => setShowDraftSheet(true)}
                    className="lg:hidden relative flex items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ml-2">
                    <FileText size={16} />
                    {drafts.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold leading-none">
                        {drafts.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Textarea — auto grow */}
                <textarea
                  ref={textRef}
                  value={content}
                  onChange={e => handleContentChange(e.target.value)}
                  onInput={e => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = el.scrollHeight + "px";
                  }}
                  placeholder={requoteId ? "Add your thoughts…" : "What's on your mind?"}
                  rows={4}
                  className="w-full mt-2 resize-none text-gray-900 dark:text-white text-[15px] leading-relaxed placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none bg-transparent overflow-hidden"
                />

                {/* Requote embed */}
                {requoteId && (
                  requoteLoading ? (
                    <div className="mt-3 border border-gray-100 dark:border-gray-800 rounded-xl p-3 animate-pulse">
                      <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                      <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded" />
                    </div>
                  ) : requotePost ? (
                    <RequoteEmbed post={requotePost} />
                  ) : null
                )}

                {/* Hashtag pills */}
                {detectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {detectedTags.map(tag => <HashtagPill key={tag} tag={tag} />)}
                  </div>
                )}

                {/* Poll editor */}
                {showPoll && (
                  <PollEditor
                    options={pollOptions} setOptions={setPollOptions}
                    duration={pollDuration} setDuration={setPollDuration}
                  />
                )}

                {/* Media grid */}
                <MediaGrid items={attachments} onRemove={removeAttachment} />
              </div>
            </div>

            {/* Autocomplete dropdown */}
            {(suggestions.length > 0 || acLoading) && acTrigger && (
              <div className="px-4 pb-2">
                <AutocompleteDropdown
                  suggestions={suggestions}
                  onSelect={applyAutocomplete}
                  loading={acLoading}
                />
              </div>
            )}

            {/* Auto-detected category hint */}
            {content.trim().length > 20 && category !== "top" && (
              <div className="px-4 pb-2">
                <span className="text-[11px] text-gray-400 dark:text-gray-600 flex items-center gap-1">
                  ✦ Auto-categorised as <span className="font-semibold text-blue-500">{CAT_LABELS[category]}</span>
                </span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mx-4 mb-2 px-3 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 rounded-xl flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* ── Bottom toolbar ── */}
          <div className={`border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 shrink-0 ${posted ? "opacity-50 pointer-events-none" : ""}`}>
            <div className="flex items-center gap-1">

              {/* Image */}
              <button onClick={() => imageRef.current?.click()}
                disabled={attachments.length >= 10}
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-500 disabled:opacity-40 transition-colors">
                <ImagePlus size={19} />
              </button>
              <input ref={imageRef} type="file" accept="image/*" multiple hidden
                onChange={e => e.target.files && addImages(e.target.files)} />

              {/* Video */}
              <button onClick={() => videoRef.current?.click()}
                disabled={attachments.length >= 10}
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-500 disabled:opacity-40 transition-colors">
                <Video size={19} />
              </button>
              <input ref={videoRef} type="file" accept="video/*" hidden
                onChange={e => e.target.files?.[0] && addVideo(e.target.files[0])} />

              {/* Poll */}
              {!requoteId && (
                <button onClick={() => setShowPoll(!showPoll)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    showPoll ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50" : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-500"
                  }`}>
                  <BarChart2 size={19} />
                </button>
              )}

              {/* Comments off */}
              <button onClick={() => setCommentsOff(!commentsOff)}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  commentsOff ? "text-orange-500 bg-orange-50 dark:bg-orange-950/30" : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-orange-500"
                }`}
                title={commentsOff ? "Comments off" : "Comments on"}>
                <MessageSquareOff size={19} />
              </button>

              <div className="flex-1" />

              {/* Char counter — SVG circle */}
              <CharCounter chars={charCount} limit={CHAR_LIMIT} />
            </div>
          </div>
        </div>

        {/* ── DESKTOP DRAFT PANEL ── */}
        <DraftPanel drafts={drafts} onLoad={handleLoadDraft} onDelete={handleDeleteDraft} />
      </div>

      {/* ── Modals ── */}
      {showPinModal && (
        <AnonPinModal
          onSuccess={() => { setShowPinModal(false); setPinVerified(true); setIsAnon(true); }}
          onCancel={() => setShowPinModal(false)}
        />
      )}
      {showDraftSheet && (
        <DraftSheet
          drafts={drafts}
          onLoad={handleLoadDraft}
          onDelete={handleDeleteDraft}
          onClose={() => setShowDraftSheet(false)}
        />
      )}
    </AppShell>
  );
}

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  ArrowLeft, ImagePlus, Video, X, Shield, User,
  Loader2, Check, MessageSquareOff, BarChart2,
  FileText, Hash, AtSign, Plus, Trash2,
  Clock, AlertCircle, ChevronLeft, ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase, verifyAnonPin } from "../lib/supabase";
import { fetchPostById, type LivePost } from "../services/feedService";
import { AppShell } from "../components/AppShell";

/*
  DB NOTE — run this SQL to increase char limit to 1000:
    ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_body_check;
    ALTER TABLE posts ADD CONSTRAINT posts_body_check
      CHECK (char_length(body) <= 1000);
  CHAR_LIMIT is now 1000 — run SPHERE_FIXES.sql to update the DB constraint.
*/
const CHAR_LIMIT    = 1000; // DB constraint updated via SPHERE_FIXES.sql
const MAX_HASHTAGS  = 10;
const MAX_MENTIONS  = 10;
const CIRCLE_R      = 16;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;

/* ─── Valid categories (must match DB CHECK constraint) ─── */
const VALID_CATS = [
  "top","city","sports","science","entertainment",
  "world","tech","politics","music","food","other",
] as const;
type Category = typeof VALID_CATS[number];

/* ─── Auto-detect category ─── */
const CAT_KW: Record<Category, string[]> = {
  sports:        ["cricket","ipl","football","hockey","tennis","match","score","goal","league","player","wicket","bcci","fifa","nba"],
  entertainment: ["movie","film","bollywood","hollywood","celebrity","actor","actress","series","ott","netflix","amazon","hotstar"],
  tech:          ["tech","coding","software","app","startup","programming","javascript","python","ai","chatgpt","openai","github"],
  science:       ["science","isro","nasa","research","space","biology","physics","chemistry","satellite","rocket"],
  politics:      ["politics","election","government","parliament","vote","minister","bjp","congress","party","rally"],
  music:         ["music","song","album","singer","concert","rap","beats","playlist","spotify","artist","lyrics"],
  food:          ["food","recipe","restaurant","biryani","pizza","coffee","dinner","lunch","breakfast","chef"],
  city:          ["city","mumbai","delhi","bangalore","chennai","kolkata","hyderabad","pune","local","traffic","metro"],
  world:         ["global","international","war","peace","usa","uk","china","russia","un","nato","treaty"],
  top:[], other:[],
};
function autoDetect(text: string): Category {
  const low = text.toLowerCase();
  let best: Category = "top", score = 0;
  for (const [cat, kws] of Object.entries(CAT_KW)) {
    const s = kws.filter(k => low.includes(k)).length;
    if (s > score) { score = s; best = cat as Category; }
  }
  return best;
}

/* ─── Image compression ─── */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 300_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const MAX = 1920;
    const sc  = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    const c   = document.createElement("canvas");
    c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise(res => c.toBlob(
      b => res(b && b.size < file.size ? new File([b], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file),
      "image/jpeg", 0.82));
  } catch { return file; }
}

/* ─── Types ─── */
interface AttachItem { type: "image"|"video"; url: string; file: File }
interface Draft {
  id: string; content: string; category: Category; isAnon: boolean;
  showPoll: boolean; pollOptions: string[]; pollDuration: number;
  createdAt: number; updatedAt: number;
  /* media is session-only (File objects can't persist to localStorage) */
}
interface Suggestion { type: "hashtag"|"mention"; value: string; label: string; sublabel?: string; avatar?: string|null }

/* ─── Draft store ─── */
const DRAFT_KEY = "sphere_drafts_v3";
const loadDrafts = (): Draft[] => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY)||"[]"); } catch { return []; } };
const saveDrafts = (d: Draft[]) => localStorage.setItem(DRAFT_KEY, JSON.stringify(d));

function timeAgo(ts: number) {
  const d = Date.now()-ts, m = Math.floor(d/60000);
  if (m<1) return "just now"; if (m<60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h<24) return `${h}h ago`; return `${Math.floor(h/24)}d ago`;
}

/* ══════════════════════════════════════════════════════════════
   CHAR COUNTER — SVG circle (X/Twitter style)
══════════════════════════════════════════════════════════════ */
function CharCounter({ chars, limit }: { chars: number; limit: number }) {
  const pct    = Math.min(chars / limit, 1.3);
  const offset = CIRCUMFERENCE * (1 - Math.min(pct, 1));
  const over   = chars > limit;
  const warn   = chars >= limit * 0.85;
  const rem    = limit - chars;
  const color  = over ? "#ef4444" : warn ? "#f59e0b" : "#3b82f6";
  const SIZE   = 30; // slightly wider than tall: use 30×30
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: 32, height: 30 }}>
      <svg width={SIZE} height={SIZE} viewBox="0 0 36 36" className="-rotate-90">
        <circle cx="18" cy="18" r={CIRCLE_R} fill="none" stroke="#e5e7eb"
          className="dark:stroke-gray-700" strokeWidth="2.8" />
        <circle cx="18" cy="18" r={CIRCLE_R} fill="none" stroke={color} strokeWidth="2.8"
          strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.1s linear, stroke 0.2s" }} />
      </svg>
      {(over || rem <= 100) && (
        <span className={`absolute text-[9px] font-bold tabular-nums leading-none ${over?"text-red-500":warn?"text-amber-500":"text-gray-500 dark:text-gray-400"}`}>
          {over ? `-${Math.abs(rem)}` : rem}
        </span>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ANON PIN MODAL
══════════════════════════════════════════════════════════════ */
function AnonPinModal({ onSuccess, onCancel }: { onSuccess:()=>void; onCancel:()=>void }) {
  const { user } = useAuth();
  const [pin, setPin]     = useState("");
  const [err, setErr]     = useState("");
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locked, setLocked]   = useState(false);
  const [secs, setSecs]       = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(()=>ref.current?.focus(),100); },[]);
  useEffect(() => {
    if (!locked) return;
    const iv = setInterval(()=>setSecs(s=>{if(s<=1){setLocked(false);clearInterval(iv);return 0;}return s-1;}),1000);
    return ()=>clearInterval(iv);
  },[locked]);

  const handlePin = async (v: string) => {
    if (locked||loading) return;
    setPin(v); setErr("");
    if (v.length===4) {
      setLoading(true);
      try {
        const r = await verifyAnonPin(v);
        setLoading(false);
        if (r.success) { onSuccess(); return; }
        if (r.locked) { setLocked(true); setSecs(1800); setErr("Too many attempts — locked 30 min"); }
        else { setShake(true); setErr(`Wrong PIN — ${r.attempts_left} left`); setTimeout(()=>{setShake(false);setPin("");},500); }
      } catch { setLoading(false); setShake(true); setErr("Failed. Try again."); setTimeout(()=>{setShake(false);setPin("");},500); }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative w-full max-w-sm mx-auto bg-white dark:bg-gray-900 rounded-t-3xl lg:rounded-3xl p-6 shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-gray-900 dark:bg-gray-700 flex items-center justify-center mx-auto mb-3">
          <Shield size={22} className="text-gray-200" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-1">Anonymous Mode</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-5">Enter your 4-digit PIN</p>
        <div className={`flex gap-3 justify-center mb-4 ${shake?"[animation:shake_0.3s_ease]":""}`}>
          {[0,1,2,3].map(i=>(
            <div key={i} className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all ${
              pin.length>i?"border-gray-900 dark:border-gray-300 bg-gray-900 dark:bg-gray-100":"border-gray-200 dark:border-gray-600"
            }`}>{pin.length>i && <div className="w-2.5 h-2.5 rounded-full bg-white dark:bg-gray-900"/>}</div>
          ))}
        </div>
        {loading && <div className="flex justify-center mb-2"><Loader2 size={16} className="animate-spin text-blue-500"/></div>}
        {err && <p className="text-center text-xs text-red-500 mb-2">{err}</p>}
        {locked && <p className="text-center text-xs text-orange-500 mb-2">Try again in {secs}s</p>}
        <input ref={ref} type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={4}
          value={pin} onChange={e=>handlePin(e.target.value.replace(/\D/g,""))}
          className="sr-only" readOnly={locked||loading} autoFocus />
        <div className="grid grid-cols-3 gap-2.5">
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i)=>(
            <button key={i} disabled={locked||loading||(typeof k==="string"&&k==="")}
              onClick={()=>{if(k==="⌫")handlePin(pin.slice(0,-1));else if(k!=="")handlePin(pin+String(k));}}
              className={`h-11 rounded-xl text-lg font-semibold transition-all active:scale-95 ${
                k===""?"pointer-events-none":k==="⌫"?"bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300":
                "bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
              } ${locked||loading?"opacity-40":""}`}>{k}</button>
          ))}
        </div>
        <button onClick={onCancel} className="mt-3 w-full py-2 text-sm text-gray-500 dark:text-gray-400 font-semibold">Cancel</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MEDIA PREVIEW SLIDER MODAL
   ══════════════════════════════════════════════════════════════ */
   function MediaSlider({ items, startIdx, onClose }: { items: AttachItem[]; startIdx: number; onClose: ()=>void }) {
     const [idx,      setIdx]      = useState(startIdx);
       const [dragging, setDragging] = useState(false);
         const [dragOff,  setDragOff]  = useState(0);  // px offset while dragging
           const touchStartX = useRef(0);
             const touchStartT = useRef(0);
               const trackRef    = useRef<HTMLDivElement>(null);

                 const goTo = (i: number) => { setIdx(Math.max(0, Math.min(items.length-1, i))); setDragOff(0); };
                   const prev = () => goTo(idx - 1);
                     const next = () => goTo(idx + 1);

                       /* Touch: track start */
                         const onTouchStart = (e: React.TouchEvent) => {
                             touchStartX.current = e.touches[0].clientX;
                                 touchStartT.current = Date.now();
                                     setDragging(true);
                                       };

                                         /* Touch: live drag offset */
                                           const onTouchMove = (e: React.TouchEvent) => {
                                               if (!dragging) return;
                                                   const dx = e.touches[0].clientX - touchStartX.current;
                                                       // Resist at edges
                                                           const atStart = idx === 0 && dx > 0;
                                                               const atEnd   = idx === items.length - 1 && dx < 0;
                                                                   setDragOff(atStart || atEnd ? dx * 0.25 : dx);
                                                                     };

                                                                       /* Touch: release — decide swipe or snap back */
                                                                         const onTouchEnd = (e: React.TouchEvent) => {
                                                                             setDragging(false);
                                                                                 const dx       = e.changedTouches[0].clientX - touchStartX.current;
                                                                                     const dt       = Date.now() - touchStartT.current;
                                                                                         const velocity = Math.abs(dx) / dt; // px/ms
                                                                                             const w        = trackRef.current?.clientWidth || 300;
                                                                                                 const threshold = velocity > 0.3 || Math.abs(dx) > w * 0.35;
                                                                                                     if (threshold && dx < 0) next();
                                                                                                         else if (threshold && dx > 0) prev();
                                                                                                             else setDragOff(0);
                                                                                                               };

                                                                                                                 /* Translate: each slide = 100% width. Current slide + drag offset. */
                                                                                                                   const translatePx = -(idx * 100); // percent

                                                                                                                     return (
                                                                                                                         <div className="fixed inset-0 z-[200] bg-black overflow-hidden">
                                                                                                                               {/* Close */}
                                                                                                                                     <button onClick={onClose}
                                                                                                                                             className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white">
                                                                                                                                                     <X size={20}/>
                                                                                                                                                           </button>
                                                                                                                                                                 {/* Counter */}
                                                                                                                                                                       <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full">
                                                                                                                                                                               {idx+1} / {items.length}
                                                                                                                                                                                     </div>

                                                                                                                                                                                           {/* Track — slides laid out horizontally */}
                                                                                                                                                                                                 <div ref={trackRef}
                                                                                                                                                                                                         className="absolute inset-0 flex items-center"
                                                                                                                                                                                                                 style={{
                                                                                                                                                                                                                           transform: `translateX(calc(${translatePx}% + ${dragOff}px))`,
                                                                                                                                                                                                                                     transition: dragging ? "none" : "transform 320ms cubic-bezier(0.25,0.46,0.45,0.94)",
                                                                                                                                                                                                                                               willChange: "transform",
                                                                                                                                                                                                                                                         width: `${items.length * 100}%`,
                                                                                                                                                                                                                                                                 }}
                                                                                                                                                                                                                                                                         onTouchStart={onTouchStart}
                                                                                                                                                                                                                                                                                 onTouchMove={onTouchMove}
                                                                                                                                                                                                                                                                                         onTouchEnd={onTouchEnd}
                                                                                                                                                                                                                                                                                               >
                                                                                                                                                                                                                                                                                                       {items.map((item, i) => (
                                                                                                                                                                                                                                                                                                                 <div key={i} className="flex items-center justify-center"
                                                                                                                                                                                                                                                                                                                             style={{ width: `${100 / items.length}%`, height: "100vh", padding: "0 48px" }}>
                                                                                                                                                                                                                                                                                                                                         {item.type === "video"
                                                                                                                                                                                                                                                                                                                                                       ? <video src={item.url} controls={i === idx} autoPlay={i === idx}
                                                                                                                                                                                                                                                                                                                                                                         className="max-w-full max-h-full object-contain rounded-xl"/>
                                                                                                                                                                                                                                                                                                                                                                                       : <img src={item.url} alt="" className="max-w-full max-h-full object-contain rounded-xl
                                                                                                                                                                                                                                                                                                                                                                                                         select-none" draggable={false}/>}
                                                                                                                                                                                                                                                                                                                                                                                                                   </div>
                                                                                                                                                                                                                                                                                                                                                                                                                           ))}
                                                                                                                                                                                                                                                                                                                                                                                                                                 </div>

                                                                                                                                                                                                                                                                                                                                                                                                                                       {/* Arrow buttons — only on desktop */}
                                                                                                                                                                                                                                                                                                                                                                                                                                             {idx > 0 && (
                                                                                                                                                                                                                                                                                                                                                                                                                                                     <button onClick={prev}
                                                                                                                                                                                                                                                                                                                                                                                                                                                               className="hidden lg:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/60 backdrop-blur-sm items-center justify-center text-white hover:bg-black/80 transition-colors">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                         <ChevronLeft size={22}/>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 </button>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       )}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             {idx < items.length - 1 && (
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     <button onClick={next}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               className="hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/60 backdrop-blur-sm items-center justify-center text-white hover:bg-black/80 transition-colors">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         <ChevronRight size={22}/>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 </button>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       )}

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             {/* Dots */}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   {items.length > 1 && (
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 items-center">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     {items.map((_,i) => (
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 <button key={i} onClick={()=>goTo(i)}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               className="rounded-full transition-all duration-300"
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             style={{
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             width:  i === idx ? 20 : 7,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             height: 7,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             background: i === idx ? "white" : "rgba(255,255,255,0.4)",
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           }}/>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     ))}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   )}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         );
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         
/* ══════════════════════════════════════════════════════════════
   SMART MEDIA GRID
══════════════════════════════════════════════════════════════ */
function MediaGrid({ items, onRemove, onPreview }: {
  items: AttachItem[]; onRemove:(i:number)=>void; onPreview:(i:number)=>void;
}) {
  if (!items.length) return null;
  const Cell = ({ item, i, cls }: { item: AttachItem; i: number; cls: string }) => (
    <div className={`relative overflow-hidden bg-gray-900 cursor-pointer ${cls}`}
      onClick={()=>onPreview(i)}>
      {item.type==="video"
        ? <video src={item.url} className="w-full h-full object-cover pointer-events-none"/>
        : <img src={item.url} alt="" className="w-full h-full object-cover"/>}
      <button onClick={e=>{e.stopPropagation();onRemove(i);}}
        className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors z-10">
        <X size={10} className="text-white"/>
      </button>
      {item.type==="video" && (
        <div className="absolute bottom-1 left-1 bg-black/60 rounded-full px-1.5 py-0.5 text-[9px] text-white font-bold">▶ Video</div>
      )}
      {i===3 && items.length>4 && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
          <span className="text-white font-bold text-xl">+{items.length-4}</span>
        </div>
      )}
    </div>
  );
  if (items.length===1) return <div className="mt-3 rounded-xl overflow-hidden"><Cell item={items[0]} i={0} cls="h-52 w-full"/></div>;
  if (items.length===2) return <div className="mt-3 grid grid-cols-2 gap-0.5 rounded-xl overflow-hidden h-44">{items.map((it,i)=><Cell key={i} item={it} i={i} cls="h-full"/>)}</div>;
  if (items.length===3) return (
    <div className="mt-3 grid grid-cols-2 gap-0.5 rounded-xl overflow-hidden h-44">
      <Cell item={items[0]} i={0} cls="h-full row-span-2"/>
      <div className="grid grid-rows-2 gap-0.5 h-44">{[1,2].map(i=><Cell key={i} item={items[i]} i={i} cls="h-full"/>)}</div>
    </div>
  );
  return (
    <div className="mt-3 grid grid-cols-2 gap-0.5 rounded-xl overflow-hidden">
      {items.slice(0,4).map((it,i)=><Cell key={i} item={it} i={i} cls="h-28"/>)}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   HASHTAG PILL — truncated
══════════════════════════════════════════════════════════════ */
function TagPill({ tag }: { tag: string }) {
  const clean   = tag.replace(/^#/, "");
  const display = clean.length > 14 ? clean.slice(0,13)+"…" : clean;
  return (
    <span title={tag} className="inline-flex items-center gap-0.5 text-xs bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-semibold max-w-[120px] shrink-0">
      <Hash size={9} className="shrink-0"/><span className="truncate">{display}</span>
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   REQUOTE EMBED
══════════════════════════════════════════════════════════════ */
function RequoteEmbed({ post }: { post: LivePost }) {
  const [err, setErr] = useState(false);
  const img = post.mediaItems?.find(m=>m.type==="image")?.url;
  return (
    <div className="mt-3 border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-gray-50 dark:bg-gray-800/50">
      <div className="flex items-center gap-2 mb-1.5">
        {post.user.avatar&&!err
          ? <img src={post.user.avatar} alt="" onError={()=>setErr(true)} className="w-5 h-5 rounded-full object-cover shrink-0"/>
          : <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0"><span className="text-white text-[8px] font-bold">{post.user.name[0]}</span></div>}
        <span className="text-xs font-bold text-gray-900 dark:text-white truncate">{post.user.name}</span>
        <span className="text-xs text-gray-400 shrink-0">· {post.timestamp}</span>
      </div>
      <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 leading-relaxed">{post.body}</p>
      {img && <img src={img} alt="" className="mt-1.5 rounded-lg w-full max-h-20 object-cover"/>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   POLL EDITOR
══════════════════════════════════════════════════════════════ */
const DURATIONS = [{ label:"24 hours", value:24 },{ label:"3 days", value:72 },{ label:"7 days", value:168 }];

function PollDurationPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false);
  const label = DURATIONS.find(d => d.value === value)?.label || "24 hours";
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-blue-100 hover:text-white font-semibold transition-colors">
        <Clock size={11} className="text-blue-200"/>
        {label}
        <ChevronDown size={10} className={`text-blue-200 transition-transform ${open?"rotate-180":""}`}/>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}/>
          <div className="absolute right-0 top-7 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden min-w-[120px]">
            {DURATIONS.map(d => (
              <button key={d.value} onClick={() => { onChange(d.value); setOpen(false); }}
                className={`flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors ${
                  d.value === value
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}>
                {d.label}
                {d.value === value && <Check size={13} className="ml-2"/>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PollEditor({ options, setOptions, duration, setDuration }: {
  options:string[]; setOptions:(o:string[])=>void;
  duration:number; setDuration:(d:number)=>void;
}) {
  return (
    <div className="mt-3 rounded-2xl overflow-hidden border border-blue-200 dark:border-blue-900/60">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-blue-600">
        <div className="flex items-center gap-2">
          <BarChart2 size={14} className="text-white"/>
          <span className="text-xs font-bold text-white">Poll</span>
        </div>
        <PollDurationPicker value={duration} onChange={setDuration}/>
      </div>
      {/* Options */}
      <div className="p-3 space-y-2 bg-blue-50/30 dark:bg-blue-950/10">
        {options.map((opt,i)=>(
          <div key={i} className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${i<2?"border-blue-400 dark:border-blue-600":"border-gray-300 dark:border-gray-600"}`}>
              <span className="text-[9px] font-bold text-gray-400">{i+1}</span>
            </div>
            <input value={opt} onChange={e=>{const n=[...options];n[i]=e.target.value.slice(0,60);setOptions(n);}}
              placeholder={`Option ${i+1}${i<2?" *":""}`}
              className="flex-1 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-900 dark:text-white placeholder-gray-300"/>
            {i>=2 && <button onClick={()=>setOptions(options.filter((_,j)=>j!==i))} className="text-gray-300 hover:text-red-500 transition-colors"><X size={14}/></button>}
          </div>
        ))}
        {options.length<4 && (
          <button onClick={()=>setOptions([...options,""])}
            className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold mt-1 hover:underline">
            <Plus size={12}/> Add option
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   AUTOCOMPLETE DROPDOWN (inline, above toolbar)
══════════════════════════════════════════════════════════════ */
function AcDropdown({ suggestions, loading, onSelect, onDismiss }: {
  suggestions: Suggestion[]; loading: boolean;
  onSelect:(s:Suggestion)=>void; onDismiss:()=>void;
}) {
  if (!loading && !suggestions.length) return null;
  return (
    <div className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
      {loading ? (
        <div className="flex items-center gap-2 px-4 py-2.5 text-xs text-gray-400">
          <Loader2 size={12} className="animate-spin"/> Searching…
        </div>
      ) : (
        <div className="flex overflow-x-auto gap-2 px-3 py-2.5 scrollbar-hide">
          {suggestions.map((s,i)=>(
            <button key={i} onClick={()=>onSelect(s)}
              className="shrink-0 flex items-center gap-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl px-3 py-2 transition-colors">
              {s.type==="mention" ? (
                s.avatar
                  ? <img src={s.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0"/>
                  : <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0"><span className="text-white text-[10px] font-bold">{s.label[0]}</span></div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
                  <Hash size={11} className="text-blue-600 dark:text-blue-400"/>
                </div>
              )}
              <div className="min-w-0 text-left">
                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate max-w-[100px]">{s.label}</p>
                {s.sublabel && <p className="text-[10px] text-gray-400 truncate max-w-[100px]">{s.sublabel}</p>}
              </div>
            </button>
          ))}
          <button onClick={onDismiss} className="shrink-0 w-7 h-full flex items-center justify-center text-gray-400 hover:text-gray-600">
            <X size={14}/>
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DRAFT PANEL (desktop right column)
══════════════════════════════════════════════════════════════ */
function DraftPanel({ drafts, onLoad, onDelete }: {
  drafts:Draft[]; onLoad:(d:Draft)=>void; onDelete:(id:string)=>void;
}) {
  return (
    <aside className="hidden lg:flex flex-col w-72 shrink-0 border-l border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
      <div className="sticky top-0 bg-gray-50 dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-gray-400"/>
          <span className="text-sm font-bold text-gray-900 dark:text-white">Drafts</span>
          {drafts.length>0 && <span className="ml-auto text-xs text-gray-400">{drafts.length}</span>}
        </div>
      </div>
      {drafts.length===0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
          <FileText size={24} className="text-gray-200 dark:text-gray-700 mb-2"/>
          <p className="text-xs text-gray-400 dark:text-gray-600">Drafts auto-save as you type</p>
        </div>
      ) : (
        <div className="overflow-y-auto flex-1 p-3 space-y-2">
          {drafts.map(d=>(
            <div key={d.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-3 group">
              <p className="text-xs text-gray-800 dark:text-gray-200 line-clamp-3 leading-relaxed mb-2">
                {d.content || <span className="text-gray-400 italic">No text</span>}
              </p>
              {d.showPoll && <span className="text-[10px] bg-blue-50 dark:bg-blue-950/50 text-blue-500 px-1.5 py-0.5 rounded-full">Poll</span>}
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-gray-400">{timeAgo(d.updatedAt)}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={()=>onDelete(d.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1"><Trash2 size={11}/></button>
                  <button onClick={()=>onLoad(d)} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full">Load</button>
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
   DRAFT SHEET (mobile)
══════════════════════════════════════════════════════════════ */
function DraftSheet({ drafts, onLoad, onDelete, onClose }: {
  drafts:Draft[]; onLoad:(d:Draft)=>void; onDelete:(id:string)=>void; onClose:()=>void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}/>
      <div className="relative w-full bg-white dark:bg-gray-900 rounded-t-2xl max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2"><FileText size={14} className="text-gray-400"/><span className="text-sm font-bold text-gray-900 dark:text-white">Drafts</span></div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><X size={15}/></button>
        </div>
        <div className="overflow-y-auto flex-1 p-3">
          {drafts.length===0 ? (
            <div className="text-center py-10"><FileText size={22} className="text-gray-200 dark:text-gray-700 mx-auto mb-2"/><p className="text-xs text-gray-400">No drafts yet</p></div>
          ) : (
            <div className="space-y-2">
              {drafts.map(d=>(
                <div key={d.id} className="border border-gray-100 dark:border-gray-800 rounded-xl p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{d.content||<span className="italic text-gray-400">No text</span>}</p>
                    {d.showPoll && <span className="text-[10px] bg-blue-50 dark:bg-blue-950/50 text-blue-500 px-1.5 py-0.5 rounded-full mr-1">Poll</span>}
                    <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(d.updatedAt)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={()=>onDelete(d.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={12}/></button>
                    <button onClick={()=>{onLoad(d);onClose();}} className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400 px-2.5 py-1 rounded-full">Load</button>
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
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export function CreatePostPage() {
  const navigate          = useNavigate();
  const [searchParams]    = useSearchParams();
  const { user, profile } = useAuth();
  const requoteId         = searchParams.get("requote");

  /* Core */
  const [content,     setContent]     = useState("");
  const [isAnon,      setIsAnon]      = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [commentsOff, setCommentsOff] = useState(false);
  const [attachments, setAttachments] = useState<AttachItem[]>([]);
  const [category,    setCategory]    = useState<Category>("top");
  const [posting,     setPosting]     = useState(false);
  const [posted,      setPosted]      = useState(false);
  const [error,       setError]       = useState("");
  const [draftSaved,  setDraftSaved]  = useState(false);

  /* Requote */
  const [requotePost,    setRequotePost]    = useState<LivePost|null>(null);
  const [requoteLoading, setRequoteLoading] = useState(false);

  /* Poll */
  const [showPoll,     setShowPoll]     = useState(false);
  const [pollOptions,  setPollOptions]  = useState(["",""]);
  const [pollDuration, setPollDuration] = useState(24);

  /* Modals */
  const [showPinModal,   setShowPinModal]   = useState(false);
  const [showDraftSheet, setShowDraftSheet] = useState(false);
  const [sliderIdx,      setSliderIdx]      = useState<number|null>(null);
  const [avatarErr,      setAvatarErr]      = useState(false);

  /* Drafts */
  const [drafts,         setDrafts]         = useState<Draft[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string|null>(null);

  /* Autocomplete */
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [acLoading,   setAcLoading]   = useState(false);
  const [acTrigger,   setAcTrigger]   = useState<{type:"hashtag"|"mention";word:string;start:number}|null>(null);

  /* Refs */
  const textRef  = useRef<HTMLTextAreaElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const draftTmr = useRef<ReturnType<typeof setTimeout>>();
  const acTmr    = useRef<ReturnType<typeof setTimeout>>();

  /* ── Derived ── */
  const charCount = content.length;
  const canPost   = (content.trim().length>0||attachments.length>0) && charCount<=CHAR_LIMIT && !posting && !posted;

  /* Hashtag regex — unicode-safe, matches Hindi/English */
  const HASH_RE = /#([\w\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0B00-\u0B7F]+)/gu;
  const MENT_RE = /@(\w+)/gu;

  const detectedTags  = [...new Set([...content.matchAll(HASH_RE)].map(m=>m[0]))].slice(0,MAX_HASHTAGS);
  const detectedMents = [...new Set([...content.matchAll(MENT_RE)].map(m=>m[0]))].slice(0,MAX_MENTIONS);

  /* ── Load requote ── */
  useEffect(()=>{
    if(!requoteId) return;
    setRequoteLoading(true);
    fetchPostById(requoteId, user?.id).then(p=>{setRequotePost(p);setRequoteLoading(false);}).catch(()=>setRequoteLoading(false));
  },[requoteId]);

  /* ── Load drafts ── */
  useEffect(()=>{
    setDrafts(loadDrafts().filter(d=>Date.now()-d.updatedAt<86_400_000));
    setTimeout(()=>textRef.current?.focus(),150);
  },[]);

  /* ── Auto-detect category (silent) ── */
  useEffect(()=>{ if(content.trim()) setCategory(autoDetect(content)); },[content]);

  /* ── Auto-save draft (2s debounce, deduped by content hash) ── */
  const lastSavedContent = useRef<string>("");
  useEffect(()=>{
    if(!content.trim()&&attachments.length===0) return;
    clearTimeout(draftTmr.current);
    draftTmr.current = setTimeout(()=>{
      // Dedup: don't save if content identical to last save
      const sig = content + String(showPoll) + pollOptions.join("|");
      if (sig === lastSavedContent.current) return;
      lastSavedContent.current = sig;

      const all = loadDrafts();
      const now = Date.now();
      const id  = currentDraftId||`d_${now}`;
      const nd: Draft = {
        id, content, category, isAnon,
        showPoll, pollOptions, pollDuration,
        createdAt: currentDraftId?(all.find(d=>d.id===id)?.createdAt??now):now,
        updatedAt: now,
      };
      const updated = [nd, ...all.filter(d=>d.id!==id)].slice(0,10);
      saveDrafts(updated); setDrafts(updated);
      if(!currentDraftId) setCurrentDraftId(id);
      setDraftSaved(true); setTimeout(()=>setDraftSaved(false),1500);
    },2000);
    return ()=>clearTimeout(draftTmr.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[content,isAnon,showPoll,pollOptions,pollDuration]);

  /* ── Autocomplete detection ── */
  const handleContentChange = (val: string) => {
    // Enforce max hashtags/mentions
    const tags = [...val.matchAll(HASH_RE)].map(m=>m[0]);
    const ments = [...val.matchAll(MENT_RE)].map(m=>m[0]);
    if(tags.length>MAX_HASHTAGS||ments.length>MAX_MENTIONS) {
      if(tags.length>MAX_HASHTAGS) { setError(`Max ${MAX_HASHTAGS} hashtags`); setTimeout(()=>setError(""),2000); }
      if(ments.length>MAX_MENTIONS) { setError(`Max ${MAX_MENTIONS} mentions`); setTimeout(()=>setError(""),2000); }
    }
    setContent(val.slice(0, CHAR_LIMIT+20));

    const el  = textRef.current;
    if(!el) return;
    const pos   = el.selectionStart ?? val.length;
    const left  = val.slice(0,pos);
    const hm    = left.match(/#([\w\u0900-\u097F]*)$/);
    const mm    = left.match(/@(\w*)$/);
    if(hm) { setAcTrigger({type:"hashtag",word:hm[1],start:pos-hm[0].length}); fetchHashSugg(hm[1]); }
    else if(mm) { setAcTrigger({type:"mention",word:mm[1],start:pos-mm[0].length}); fetchMentSugg(mm[1]); }
    else { setAcTrigger(null); setSuggestions([]); }
  };

  const fetchHashSugg = (word: string) => {
    clearTimeout(acTmr.current);
    if(!word){setSuggestions([]);return;}
    setAcLoading(true);
    acTmr.current = setTimeout(async()=>{
      const {data} = await supabase.from("hashtag_stats").select("tag,posts_count").ilike("tag",`${word}%`).order("posts_count",{ascending:false}).limit(5);
      setSuggestions((data||[]).map((r:any)=>({type:"hashtag",value:r.tag,label:`#${r.tag}`,sublabel:`${r.posts_count} posts`})));
      setAcLoading(false);
    },250);
  };
  const fetchMentSugg = (word: string) => {
    clearTimeout(acTmr.current);
    if(!word){setSuggestions([]);return;}
    setAcLoading(true);
    acTmr.current = setTimeout(async()=>{
      const {data} = await supabase.from("profiles").select("id,name,username,avatar_url").ilike("username",`${word}%`).limit(5);
      setSuggestions((data||[]).map((r:any)=>({type:"mention",value:r.username,label:r.name,sublabel:`@${r.username}`,avatar:r.avatar_url})));
      setAcLoading(false);
    },250);
  };

  const applyAc = (s: Suggestion) => {
    if(!acTrigger||!textRef.current) return;
    const el    = textRef.current;
    const pos   = el.selectionStart??content.length;
    const left  = content.slice(0,acTrigger.start);
    const right = content.slice(pos);
    const ins   = s.type==="hashtag"?`#${s.value} `:`@${s.value} `;
    setContent((left+ins+right).slice(0,CHAR_LIMIT+20));
    setAcTrigger(null); setSuggestions([]);
    setTimeout(()=>{ el.focus(); const p=(left+ins).length; el.setSelectionRange(p,p); },0);
  };

  /* ── Anon toggle ── */
  const toggleAnon = () => {
    if(!isAnon) {
      if(!profile?.anon_pin_set) { navigate("/settings/anon-pin?mode=create&from=create-post"); return; }
      if(!pinVerified) { setShowPinModal(true); return; }
      setIsAnon(true);
    } else setIsAnon(false);
  };

  /* ── Files ── */
  const addImages = async (files: FileList) => {
    const rem = 10-attachments.length;
    for(const f of Array.from(files).slice(0,rem)) {
      if(!f.type.startsWith("image/")) continue;
      if(f.size>20*1024*1024){setError(`${f.name} exceeds 20MB`);continue;}
      const c = await compressImage(f);
      setAttachments(prev=>[...prev,{type:"image",url:URL.createObjectURL(c),file:c}]);
    }
    setError("");
  };
  const addVideo = (f: File) => {
    if(!f.type.startsWith("video/")) return;
    if(f.size>200*1024*1024){setError("Video exceeds 200MB");return;}
    const url=URL.createObjectURL(f);
    const v=document.createElement("video"); v.preload="metadata";
    v.onloadedmetadata=()=>{
      if(v.duration>1200){setError("Video must be under 20 min");URL.revokeObjectURL(url);return;}
      setAttachments(prev=>[...prev,{type:"video",url,file:f}]);setError("");
    }; v.src=url;
  };
  const removeAttachment = (i: number) => setAttachments(prev=>{URL.revokeObjectURL(prev[i].url);return prev.filter((_,j)=>j!==i);});

  /* ── Upload ── */
  const uploadFile = async (file: File, postId: string, idx: number): Promise<string|null> => {
    const ext  = file.name.split(".").pop()||"bin";
    const path = `${user!.id}/${postId}/${idx}.${ext}`;
    const {error} = await supabase.storage.from("posts").upload(path,file,{upsert:true});
    if(error){console.error("Upload error:",error);return null;}
    return supabase.storage.from("posts").getPublicUrl(path).data.publicUrl;
  };

  /* ── Submit ── */
  const handlePost = async () => {
    if(!canPost||!user?.id) return;
    setPosting(true); setError("");
    try {
      /* Extract hashtags (unicode-safe) — THIS was the bug:
         we were using /g without /u which breaks Unicode.
         Also must reset lastIndex when reusing regex. */
      const hashMatches = [...content.matchAll(/#([\w\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F]+)/gu)];
      const hashtags    = [...new Set(hashMatches.map(m=>m[1].toLowerCase()))].slice(0,MAX_HASHTAGS);
      const mentMatches = [...content.matchAll(/@(\w+)/gu)];
      const mentions    = [...new Set(mentMatches.map(m=>m[1].toLowerCase()))].slice(0,MAX_MENTIONS);

      const isForward = !!requoteId;
      const bodyText  = content.trim() || (isForward ? "— forwarded" : "");

      if(!bodyText && attachments.length===0) { setError("Write something or add media"); setPosting(false); return; }

      const insertData: Record<string,unknown> = {
        user_id:      user.id,
        body:         bodyText.slice(0, 1000),   /* hard-cap to DB limit */
        category:     category,
        is_anon:      isAnon,
        hashtags,
        mentions,
        comments_off: commentsOff,
        is_forward:   isForward,
        ...(isForward && requoteId ? { forward_of: requoteId, forward_comment: bodyText } : {}),
      };

      const {data:row, error:pErr} = await supabase.from("posts").insert(insertData).select("id").single();
      if(pErr||!row) { console.error("Post insert error:",pErr); setError(pErr?.message||"Failed to create post"); setPosting(false); return; }

      /* Upload media */
      if(attachments.length>0) {
        const urls = await Promise.all(attachments.map((a,i)=>uploadFile(a.file,row.id,i)));
        const mediaRows = urls.map((url,i)=>url?{post_id:row.id,url,media_type:attachments[i].type,position:i}:null).filter(Boolean);
        if(mediaRows.length>0) await supabase.from("post_media").insert(mediaRows);
      }

      /* Insert poll */
      if(showPoll) {
        const valid = pollOptions.filter(o=>o.trim());
        if(valid.length>=2) {
          await supabase.from("post_polls").insert({
            post_id: row.id,
            options: valid.map(text=>({text})),
            duration_hours: pollDuration,
            ends_at: new Date(Date.now()+pollDuration*3_600_000).toISOString(),
          });
        }
      }

      /* Clear draft */
      if(currentDraftId) saveDrafts(loadDrafts().filter(d=>d.id!==currentDraftId));

      setPosted(true);
      setTimeout(()=>navigate("/feed"),700);
    } catch(e:any) {
      console.error(e); setError(e?.message||"Something went wrong"); setPosting(false);
    }
  };

  /* ── Draft actions ── */
  const handleLoadDraft = (d: Draft) => {
    setContent(d.content); setCategory(d.category); setIsAnon(d.isAnon);
    /* Only restore poll if user had it ON in that draft */
    if(d.showPoll && d.pollOptions?.length>=2) { setShowPoll(true); setPollOptions(d.pollOptions); setPollDuration(d.pollDuration||24); }
    else { setShowPoll(false); setPollOptions(["",""]); }
    setCurrentDraftId(d.id);
  };
  const handleDeleteDraft = (id: string) => {
    const u=loadDrafts().filter(d=>d.id!==id); saveDrafts(u); setDrafts(u);
    if(currentDraftId===id) setCurrentDraftId(null);
  };

  /* Display */
  const displayName   = isAnon ? (profile?.anon_username ? `@${profile.anon_username}` : "Anonymous") : (profile?.name||"You");
  const displayUser   = isAnon ? null : profile?.username;
  const displayAvatar = isAnon ? null : (avatarErr ? null : profile?.avatar_url);

  /* ══════════════ RENDER ══════════════════════════════════════ */
  return (
    <AppShell>
      {/* Outer: flex column, full height — toolbar stays above keyboard */}
      <div className="flex h-full bg-white dark:bg-gray-950">

        {/* ── Compose column ── */}
        <div className="flex-1 min-w-0 flex flex-col h-full">

          {/* ── Sticky header ── */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0 bg-white dark:bg-gray-900 z-10">
            <button onClick={()=>navigate(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0">
              <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300"/>
            </button>
            <h1 className="font-bold text-gray-900 dark:text-white text-base flex-1">
              {requoteId?"Requote":"Create Quote"}
            </h1>
            {draftSaved && <span className="text-[10px] text-gray-400 font-medium">Saved</span>}
            {/* Anon toggle */}
            <button onClick={toggleAnon}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border-2 text-[11px] font-bold transition-all ${
                isAnon
                  ?"border-gray-800 dark:border-gray-300 bg-gray-900 dark:bg-gray-100 text-gray-200 dark:text-gray-900"
                  :"border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400"
              }`}>
              {isAnon?<Shield size={11} className="text-gray-300 dark:text-gray-700"/>:<User size={11}/>}
              {isAnon?"Anon":"You"}
            </button>
            {/* Post button */}
            <button onClick={handlePost} disabled={!canPost}
              className={`px-4 py-1.5 rounded-full font-bold text-sm transition-all ${
                canPost?"bg-blue-600 text-white hover:bg-blue-700 shadow-sm":"bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600"
              }`}>
              {posted?<span className="flex items-center gap-1"><Check size={12}/>Done</span>
               :posting?<span className="flex items-center gap-1"><Loader2 size={12} className="animate-spin"/>Posting</span>
               :(requoteId?"Requote":"Post")}
            </button>
          </div>

          {/* ── Scrollable compose body ── */}
          {/* pb-14 on mobile reserves space for the fixed toolbar; lg:pb-0 on desktop */}
          <div className="flex-1 overflow-y-auto overscroll-contain pb-14 lg:pb-0">

            {/* User row */}
            <div className="flex items-start gap-3 px-4 pt-3 pb-2">
              {/* Avatar */}
              <div className="shrink-0 mt-0.5">
                {isAnon ? (
                  <div className="w-10 h-10 rounded-full bg-gray-800 dark:bg-gray-700 flex items-center justify-center">
                    <Shield size={18} className="text-gray-300"/>
                  </div>
                ) : displayAvatar ? (
                  <img src={displayAvatar} alt="me" onError={()=>setAvatarErr(true)}
                    className="w-10 h-10 rounded-full object-cover"/>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-base">
                    {displayName[0]?.toUpperCase()||"U"}
                  </div>
                )}
              </div>

              {/* Name + username + draft button */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                      {displayName}
                      {isAnon && <span className="ml-1.5 text-[9px] bg-gray-800 dark:bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full align-middle">anon</span>}
                    </p>
                    {!isAnon && displayUser && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 leading-tight">@{displayUser}</p>
                    )}
                    {isAnon && profile?.anon_username && (
                      <p className="text-xs text-gray-500 dark:text-gray-600 leading-tight">@{profile.anon_username}</p>
                    )}
                  </div>
                  {/* Draft icon — mobile */}
                  <button onClick={()=>setShowDraftSheet(true)}
                    className="lg:hidden relative mt-0.5 ml-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 transition-colors">
                    <FileText size={16}/>
                    {drafts.length>0 && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">{drafts.length}</span>
                    )}
                  </button>
                </div>

                {/* Textarea — auto-grow */}
                <textarea
                  ref={textRef}
                  value={content}
                  onChange={e=>handleContentChange(e.target.value)}
                  onInput={e=>{const el=e.currentTarget;el.style.height="auto";el.style.height=el.scrollHeight+"px";}}
                  placeholder={requoteId?"Add your thoughts…":"What's on your mind?"}
                  rows={4}
                  className="w-full mt-2 resize-none text-gray-900 dark:text-white text-[15px] leading-relaxed placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none bg-transparent overflow-hidden"
                />

                {/* Requote embed */}
                {requoteId && (
                  requoteLoading
                    ? <div className="mt-3 h-16 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse"/>
                    : requotePost ? <RequoteEmbed post={requotePost}/> : null
                )}

                {/* Detected tag pills */}
                {(detectedTags.length>0||detectedMents.length>0) && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {detectedTags.map(t=><TagPill key={t} tag={t}/>)}
                    {detectedMents.map(m=>(
                      <span key={m} title={m} className="inline-flex items-center gap-0.5 text-xs bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full font-semibold max-w-[120px]">
                        <AtSign size={9} className="shrink-0"/><span className="truncate">{m.slice(1).length>13?m.slice(1,14)+"…":m.slice(1)}</span>
                      </span>
                    ))}
                    {/* Limits warning */}
                    {detectedTags.length>=MAX_HASHTAGS && (
                      <span className="text-[10px] text-amber-500 flex items-center gap-0.5"><AlertCircle size={9}/> max {MAX_HASHTAGS} hashtags</span>
                    )}
                  </div>
                )}

                {/* Poll */}
                {showPoll && (
                  <PollEditor options={pollOptions} setOptions={setPollOptions} duration={pollDuration} setDuration={setPollDuration}/>
                )}

                {/* Media grid */}
                <MediaGrid items={attachments} onRemove={removeAttachment} onPreview={i=>setSliderIdx(i)}/>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mx-4 mb-2 px-3 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 rounded-xl flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle size={13} className="shrink-0"/>{error}
              </div>
            )}
          </div>

          {/* ── Autocomplete — fixed above toolbar on mobile, inline on desktop ── */}
          {(acLoading||suggestions.length>0) && acTrigger && (
            <>
              {/* Mobile: fixed just above the toolbar */}
              <div className="lg:hidden fixed bottom-14 left-0 right-0 z-40 shadow-xl">
                <AcDropdown suggestions={suggestions} loading={acLoading} onSelect={applyAc} onDismiss={()=>{setAcTrigger(null);setSuggestions([]);}}/>
              </div>
              {/* Desktop: inline between body and toolbar */}
              <div className="hidden lg:block">
                <AcDropdown suggestions={suggestions} loading={acLoading} onSelect={applyAc} onDismiss={()=>{setAcTrigger(null);setSuggestions([]);}}/>
              </div>
            </>
          )}

          {/* ── Toolbar ──
              Mobile: position fixed at bottom of viewport — always above keyboard.
              Desktop: shrink-0 in the flex column.
          ── */}
          <div className={`
            fixed bottom-0 left-0 right-0 lg:static lg:bottom-auto
            border-t border-gray-100 dark:border-gray-800
            bg-white dark:bg-gray-900
            px-4 py-2.5
            lg:shrink-0
            z-30
            ${posted?"opacity-50 pointer-events-none":""}
          `} style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom, 10px))" }}>
            <div className="flex items-center gap-1">
              {/* Image */}
              <button onClick={()=>imageRef.current?.click()} disabled={attachments.length>=10}
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-500 disabled:opacity-40 transition-colors">
                <ImagePlus size={19}/>
              </button>
              <input ref={imageRef} type="file" accept="image/*" multiple hidden onChange={e=>e.target.files&&addImages(e.target.files)}/>
              {/* Video */}
              <button onClick={()=>videoRef.current?.click()} disabled={attachments.length>=10}
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-500 disabled:opacity-40 transition-colors">
                <Video size={19}/>
              </button>
              <input ref={videoRef} type="file" accept="video/*" hidden onChange={e=>e.target.files?.[0]&&addVideo(e.target.files[0])}/>
              {/* Poll */}
              {!requoteId && (
                <button onClick={()=>setShowPoll(!showPoll)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    showPoll?"text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50":"text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-500"
                  }`}>
                  <BarChart2 size={19}/>
                </button>
              )}
              {/* Comments off */}
              <button onClick={()=>setCommentsOff(!commentsOff)}
                title={commentsOff?"Comments off":"Comments on"}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  commentsOff?"text-orange-500 bg-orange-50 dark:bg-orange-950/30":"text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-orange-500"
                }`}>
                <MessageSquareOff size={19}/>
              </button>
              <div className="flex-1"/>
              <CharCounter chars={charCount} limit={CHAR_LIMIT}/>
            </div>
          </div>
        </div>

        {/* ── Desktop draft panel ── */}
        <DraftPanel drafts={drafts} onLoad={handleLoadDraft} onDelete={handleDeleteDraft}/>
      </div>

      {/* ── Modals ── */}
      {showPinModal && (
        <AnonPinModal onSuccess={()=>{setShowPinModal(false);setPinVerified(true);setIsAnon(true);}} onCancel={()=>setShowPinModal(false)}/>
      )}
      {showDraftSheet && (
        <DraftSheet drafts={drafts} onLoad={handleLoadDraft} onDelete={handleDeleteDraft} onClose={()=>setShowDraftSheet(false)}/>
      )}
      {sliderIdx!==null && (
        <MediaSlider items={attachments} startIdx={sliderIdx} onClose={()=>setSliderIdx(null)}/>
      )}
    </AppShell>
  );
}

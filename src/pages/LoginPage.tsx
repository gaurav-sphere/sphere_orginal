import React, {
  useState, useRef, useEffect,
} from "react";
import { useNavigate } from "react-router";
import {
  Eye, EyeOff, ArrowLeft, ArrowRight,
  Shield, Info, X, ChevronDown, Check,
  AlertCircle, Loader2, Sparkles, RefreshCw, ThumbsUp, Lock, Unlock,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

type Mode = "login" | "register";
type Step = 1 | 2;

function getMaxDob(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 14);
  return d.toISOString().split("T")[0];
}

/* ════════════════════════════════════════
   UI HELPERS
════════════════════════════════════════ */
function FieldError({ msg }: { msg: string | null | undefined }) {
  if (!msg) return null;
  return (
    <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-2.5 py-2 mb-1.5 text-red-600 text-xs font-semibold">
      <AlertCircle size={12} className="flex-shrink-0" />
      {msg}
    </div>
  );
}

type AvailState = "idle" | "checking" | "ok" | "taken";
function AvailBadge({ state }: { state: AvailState }) {
  if (state === "idle")     return null;
  if (state === "checking") return <span className="text-xs text-gray-400">Checking…</span>;
  if (state === "ok")       return <span className="text-xs text-green-600 font-bold">✓ Available</span>;
  return <span className="text-xs text-red-500 font-bold">✗ Already taken</span>;
}

function Spinner() {
  return <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
  </svg>;
}

/* ════════════════════════════════════════
   CROSS AVAILABILITY HOOK
   Checks BOTH username AND anon_username
════════════════════════════════════════ */
function useCrossAvailability(value: string): AvailState {
  const [state, setState] = useState<AvailState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(timer.current);
    const clean = value.replace(/^@/, "").trim();
    if (clean.length < 3) { setState("idle"); return; }
    setState("checking");
    timer.current = setTimeout(async () => {
      const [r1, r2] = await Promise.all([
        supabase.from("profiles").select("id").eq("username",      clean).maybeSingle(),
        supabase.from("profiles").select("id").eq("anon_username", clean).maybeSingle(),
      ]);
      setState((r1.data || r2.data) ? "taken" : "ok");
    }, 600);
    return () => clearTimeout(timer.current);
  }, [value]);
  return state;
}

/* ════════════════════════════════════════
   USERNAME SUGGESTIONS
   Uses name + email, numbers, cool words
   Seed rotates on "Suggest" button click
════════════════════════════════════════ */
const COOL_SUFFIX_WORDS = [
  "veer","tej","arya","dev","shiv","rishi","raj","kiran","neo","zen","adi","rix","ace",
];

function buildCandidates(fullName: string, email: string, seed: number): string[] {
  const parts = fullName.trim().toLowerCase()
    .replace(/[^a-z0-9 ]/g, "").split(" ").filter(Boolean);

  // Extract username part from email
  const emailLocal = email.split("@")[0].toLowerCase()
    .replace(/[^a-z0-9]/g, "").slice(0, 12);

  if (parts.length === 0 && !emailLocal) return [];

  const first = parts[0] ?? emailLocal.slice(0, 6);
  const last  = parts.length > 1 ? parts[parts.length - 1] : "";
  const init  = parts.map(p => p[0]).join("");

  // Name-based bases
  const nameBases = last
    ? [`${first}${last}`, `${first}_${last}`, `${first[0]}${last}`, `${last}_${first[0]}`, `${init}`, `${first}`]
    : [first, `${first}_`, `_${first}`];

  // Email-based bases
  const emailBases = emailLocal
    ? [`${emailLocal}`, `${emailLocal}_`]
    : [];

  // Cool word combos (fewer, name+cool)
  const coolBases = COOL_SUFFIX_WORDS
    .slice(seed % COOL_SUFFIX_WORDS.length, (seed % COOL_SUFFIX_WORDS.length) + 2)
    .map(w => first ? `${first}_${w}` : w);

  const allBases = [...nameBases, ...emailBases, ...coolBases];

  // Num suffixes — more variety
  const nums = ["42","99","786","007","100","21","11","01","77","55","23","08","9","1"];

  const out: string[] = [];
  for (let i = 0; i < allBases.length * 3; i++) {
    const base   = allBases[(i + seed) % allBases.length];
    const numIdx = (i + seed) % nums.length;
    // Alternate: no suffix, suffix, suffix2
    const suffix = i < allBases.length ? "" : nums[numIdx];
    const cand   = `${base}${suffix}`.slice(0, 20);
    if (/^[a-zA-Z0-9_]{3,20}$/.test(cand)) out.push(cand);
  }
  return [...new Set(out)];
}

function useUsernameSuggestions(fullName: string, email: string, seed: number) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading]         = useState(false);

  useEffect(() => {
    const candidates = buildCandidates(fullName, email, seed);
    if (candidates.length === 0) { setSuggestions([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      const checks = await Promise.all(
        candidates.map(c =>
          Promise.all([
            supabase.from("profiles").select("id").eq("username",      c).maybeSingle(),
            supabase.from("profiles").select("id").eq("anon_username", c).maybeSingle(),
          ]).then(([r1, r2]) => ({ name: c, taken: !!(r1.data || r2.data) }))
        )
      );
      setSuggestions(checks.filter(c => !c.taken).map(c => c.name).slice(0, 3));
      setLoading(false);
    }, 700);
    return () => { clearTimeout(t); setLoading(false); };
  }, [fullName, email, seed]);

  return { suggestions, loading };
}

/* ════════════════════════════════════════
   ANON SUGGESTIONS
   — mysterious / cosmic / Hindi-Sanskrit
════════════════════════════════════════ */
const ANON_COLORS = [
  "crimson","azure","violet","emerald","amber","indigo","coral","teal","silver",
  "golden","onyx","jade","scarlet","cobalt","ivory","slate","obsidian","aurora","Laal_singh", "Sher_khan", "Kaala_Ghoda", "Sonar", "Gulabi", "Narangi", "Jamuni", "Aabru", "Chandni", "Harit", "Shweta", "Krishna", "Suvarna", "Padma", "Arakta", "Shyava", "Tamra", "Kapila", "Haridra", "Shashi", "Ambika", "Dharma", "Shanti", "Prem", "Gyan", "Shakti", "Dhan", "Sukh", "Safalta", "Atma", "Prakriti",
];
const ANON_POOL = [
  // Cosmic / nature
  "wolf","tiger","falcon","lion","eagle","fox","bear","panther","hawk","viper",
  "cobra","phoenix","Krishna", "Gulabi", "Bhakti", "Akash", "Kalpit", "Shashi", "Pyaar", "Kala", "Antariksha", "Junoon","dragon","lynx","orca","raven","orbit","nova","comet",
  "stellar","lunar","cosmic","nebula","pulsar","quasar","zenith",
  // Hindi / Sanskrit mystical
  "agni","vayu","akash","dhruv","surya","chandra","indra","shakti","karma",
  "maya","atma","vikram","arjun","yodha","rudra","kaal","vayra","tapas","Chandra", "Agni", "Vayu", "Jala", "Prithvi", "Akash", "Antariksha", "Gagan", "Brahmanda", "Mahakaal",
];

function generateAnonSuggestions(): string[] {
  const results: string[] = [];
  const used = new Set<string>();
  let tries = 0;
  while (results.length < 3 && tries < 50) {
    tries++;
    const color = ANON_COLORS[Math.floor(Math.random() * ANON_COLORS.length)];
    const thing = ANON_POOL[Math.floor(Math.random() * ANON_POOL.length)];
    const num   = Math.floor(Math.random() * 90) + 10;
    const s     = `${color}_${thing}${num}`;
    if (!used.has(s) && s.length <= 20) { used.add(s); results.push(s); }
  }
  return results;
}

/* ════════════════════════════════════════
   ANON POST SKELETON PREVIEW
   — 👍 for Praise
════════════════════════════════════════ */
function AnonPostSkeleton({ anonUser }: { anonUser: string }) {
  const letter = anonUser.split("").find(c => /[a-zA-Z]/.test(c))?.toUpperCase() ?? "?";
  return (
    <div className="mt-3 bg-gray-50 border border-gray-200 rounded-2xl p-4">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
        <Shield size={10}/> Preview — how your anon post looks
      </p>
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {letter}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-bold text-gray-800">{anonUser}</p>
            <div className="flex items-center gap-1 bg-gray-200 rounded-full px-2 py-0.5">
              <Shield size={9} className="text-gray-500"/>
              <span className="text-[9px] font-bold text-gray-500">ANON</span>
            </div>
          </div>
          <div className="space-y-1.5">
            {[1, 0.8, 0.6].map((w, i) => (
              <div key={i} className="h-2.5 bg-gray-200 rounded-full animate-pulse" style={{ width: `${w * 100}%` }}/>
            ))}
          </div>
          <div className="flex gap-4 mt-3">
            <span className="text-[10px] text-gray-400 font-medium">💬 Thought</span>
            <span className="text-[10px] text-gray-400 font-medium">↩ Forward</span>
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400 font-medium">
              <ThumbsUp size={9}/> Praise
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   PHONE HELPERS
════════════════════════════════════════ */
const PHONE_PLACEHOLDER: Record<string, string> = {
  "+91":"98765 43210","+1":"20201 23456","+44":"07700 90012","+92":"03001 23456",
  "+880":"01711 23456","+94":"07112 34567","+977":"98412 34567","+971":"05012 34567",
  "+966":"05012 34567","+65":"81234 5678","+60":"01234 56789","+62":"08123 45678",
  "+63":"09171 23456","+81":"09012 34567","+82":"01012 34567","+86":"13812 34567",
  "+61":"04123 45678","+49":"15901 23456","+33":"06123 45678","+55":"11912 34567",
  "+7":"91234 56789","+234":"08012 34567","+27":"07112 34567","+20":"01012 34567",
  "+98":"09123 45678","+90":"05312 34567","+39":"33312 34567",
  "+34":"61234 5678","+31":"06123 45678","+64":"02112 34567",
};
function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g,"").slice(0,10);
  return d.length <= 5 ? d : d.slice(0,5) + " " + d.slice(5);
}
function stripCountryCode(pasted: string, dialCode: string): string {
  const digits = pasted.replace(/\D/g,"");
  const code   = dialCode.replace("+","");
  return (digits.startsWith(code) && digits.length > code.length + 5) ? digits.slice(code.length) : digits;
}

const DIAL_CODES = [
  {code:"+91",label:"🇮🇳 +91"},{code:"+1",label:"🇺🇸 +1"},{code:"+44",label:"🇬🇧 +44"},
  {code:"+92",label:"🇵🇰 +92"},{code:"+880",label:"🇧🇩 +880"},{code:"+94",label:"🇱🇰 +94"},
  {code:"+977",label:"🇳🇵 +977"},{code:"+971",label:"🇦🇪 +971"},{code:"+966",label:"🇸🇦 +966"},
  {code:"+65",label:"🇸🇬 +65"},{code:"+60",label:"🇲🇾 +60"},{code:"+62",label:"🇮🇩 +62"},
  {code:"+63",label:"🇵🇭 +63"},{code:"+81",label:"🇯🇵 +81"},{code:"+82",label:"🇰🇷 +82"},
  {code:"+86",label:"🇨🇳 +86"},{code:"+61",label:"🇦🇺 +61"},{code:"+49",label:"🇩🇪 +49"},
  {code:"+33",label:"🇫🇷 +33"},{code:"+55",label:"🇧🇷 +55"},{code:"+7",label:"🇷🇺 +7"},
  {code:"+234",label:"🇳🇬 +234"},{code:"+27",label:"🇿🇦 +27"},{code:"+20",label:"🇪🇬 +20"},
  {code:"+98",label:"🇮🇷 +98"},{code:"+90",label:"🇹🇷 +90"},{code:"+39",label:"🇮🇹 +39"},
  {code:"+34",label:"🇪🇸 +34"},{code:"+31",label:"🇳🇱 +31"},{code:"+64",label:"🇳🇿 +64"},
];

function PhoneInput({ dialCode, onDialChange, number, onNumberChange, hasError }: {
  dialCode: string; onDialChange: (c: string) => void;
  number: string;   onNumberChange: (n: string) => void;
  hasError?: boolean;
}) {
  const [open,     setOpen]     = useState(false);
  const [search,   setSearch]   = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sel      = DIAL_CODES.find(d => d.code === dialCode);
  const filtered = DIAL_CODES.filter(d => d.label.toLowerCase().includes(search.toLowerCase()) || d.code.includes(search));

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(""); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref}>
      <div className={`flex border rounded-full overflow-visible bg-gray-50 transition-all focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 ${hasError ? "border-red-300" : "border-gray-200"}`}>
        <button type="button" onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 px-3 py-3.5 border-r border-gray-200 bg-gray-100 text-xs font-bold text-gray-700 hover:bg-gray-200 transition-colors flex-shrink-0 rounded-l-full">
          {sel?.label ?? dialCode}
          <ChevronDown size={11} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}/>
        </button>
        <input type="tel" inputMode="numeric" value={number}
          onChange={e => onNumberChange(formatPhone(e.target.value.replace(/\D/g,"").slice(0,10)))}
          onPaste={e => { e.preventDefault(); onNumberChange(formatPhone(stripCountryCode(e.clipboardData.getData("text"), dialCode).slice(0,10))); }}
          placeholder={PHONE_PLACEHOLDER[dialCode] || "Phone number"}
          className="flex-1 px-3 py-3.5 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none select-text"/>
        <button type="button" onClick={() => setShowInfo(s => !s)}
          className="flex items-center justify-center px-3 text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0">
          <Info size={14}/>
        </button>
      </div>
      {showInfo && (
        <div className="mt-1 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 text-xs text-blue-700 leading-relaxed">
          📱 Phone is optional. If provided, it must be unique — one account per number.
          {dialCode === "+91" && " For India, must start with 6, 7, 8, or 9."}
        </div>
      )}
      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden" style={{width:220,maxHeight:240}}>
          <div className="p-2 border-b border-gray-100">
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code…"
              className="w-full px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-full focus:outline-none select-text"/>
          </div>
          <div className="overflow-y-auto" style={{maxHeight:190}}>
            {filtered.map(d => (
              <button key={d.code} type="button" onClick={() => { onDialChange(d.code); setOpen(false); setSearch(""); }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${dialCode===d.code?"text-blue-600 font-bold bg-blue-50":"text-gray-700"}`}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   GENDER & COUNTRY SELECTS
════════════════════════════════════════ */
const GENDERS = [{value:"Male",emoji:"👨"},{value:"Female",emoji:"👩"},{value:"Prefer not to say",emoji:"🤐"}];
function GenderSelect({ value, onChange, error }: { value:string; onChange:(v:string)=>void; error?:string|null }) {
  const [open,setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sel = GENDERS.find(g=>g.value===value);
  useEffect(() => {
    const h=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false);};
    document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h);
  },[]);
  return (
    <div ref={ref} className="relative">
      <FieldError msg={error}/>
      <button type="button" onClick={()=>setOpen(o=>!o)}
        className={`w-full flex items-center justify-between px-4 py-3.5 bg-gray-50 border rounded-full text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-100 select-text ${error?"border-red-300":"border-gray-200 focus:border-blue-400"}`}>
        {sel?<span className="flex items-center gap-2 text-gray-900 font-medium"><span>{sel.emoji}</span>{sel.value}</span>:<span className="text-gray-400">Select gender</span>}
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open?"rotate-180":""}`}/>
      </button>
      {open&&(
        <div className="absolute bottom-full mb-1 left-0 right-0 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 py-1 overflow-hidden">
          {GENDERS.map(g=>(
            <button key={g.value} type="button" onClick={()=>{onChange(g.value);setOpen(false);}}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-gray-50 ${value===g.value?"text-blue-600 font-bold bg-blue-50":"text-gray-700"}`}>
              <span className="text-lg">{g.emoji}</span>{g.value}
              {value===g.value&&<Check size={13} className="ml-auto text-blue-600"/>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const COUNTRIES = [
  "India","Afghanistan","Bangladesh","Bhutan","China","Indonesia","Japan","Maldives","Myanmar","Nepal",
  "Pakistan","Philippines","Singapore","Sri Lanka","Thailand","United Arab Emirates","Australia","Brazil",
  "Canada","France","Germany","Italy","Mexico","Netherlands","New Zealand","Nigeria","Russia",
  "Saudi Arabia","South Africa","South Korea","Spain","Turkey","Ukraine","United Kingdom","United States",
];
function CountrySelect({ value, onChange, error }: { value:string; onChange:(v:string)=>void; error?:string|null }) {
  const [open,setOpen]=useState(false);
  const [search,setSearch]=useState("");
  const ref=useRef<HTMLDivElement>(null);
  const filtered=COUNTRIES.filter(c=>c.toLowerCase().includes(search.toLowerCase()));
  useEffect(()=>{
    const h=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node)){setOpen(false);setSearch("");}};
    document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h);
  },[]);
  return (
    <div ref={ref} className="relative">
      <FieldError msg={error}/>
      <button type="button" onClick={()=>setOpen(o=>!o)}
        className={`w-full flex items-center justify-between px-4 py-3.5 bg-gray-50 border rounded-full text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-100 select-text ${error?"border-red-300":"border-gray-200 focus:border-blue-400"}`}>
        {value?<span className="text-gray-900 font-medium">🌍 {value}</span>:<span className="text-gray-400">Select country</span>}
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open?"rotate-180":""}`}/>
      </button>
      {open&&(
        <div className="absolute bottom-full mb-1 left-0 right-0 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden" style={{maxHeight:220}}>
          <div className="p-2 border-b border-gray-100">
            <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search country…"
              className="w-full px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-full focus:outline-none select-text"/>
          </div>
          <div className="overflow-y-auto" style={{maxHeight:160}}>
            {filtered.map(c=>(
              <button key={c} type="button" onClick={()=>{onChange(c);setOpen(false);setSearch("");}}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 ${value===c?"text-blue-600 font-bold bg-blue-50":"text-gray-700"}`}>
                {c}{value===c&&<Check size={12} className="inline ml-2 text-blue-600"/>}
              </button>
            ))}
            {filtered.length===0&&<p className="text-center text-xs text-gray-400 py-4">No match</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   CENTRE MODAL
════════════════════════════════════════ */
function CentreModal({ show, onClose, title, icon, children }: {
  show:boolean; onClose:()=>void; title:string; icon:React.ReactNode; children:React.ReactNode;
}) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
      <div className="relative z-10 w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl"
        style={{animation:"fadeScaleIn .18s ease-out"}} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">{icon}</div>
            <p className="font-bold text-gray-900 text-sm">{title}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center">
            <X size={13} className="text-gray-600"/>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   UNLOCK ACCOUNT MODAL
════════════════════════════════════════ */
function UnlockModal({ show, onClose, permanent }: { show: boolean; onClose: () => void; permanent: boolean }) {
  const { unlockAccount } = useAuth();
  const [uInput, setUInput] = useState("");
  const [eInput, setEInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<"idle"|"success"|"admin">("idle");
  const [errMsg, setErrMsg]   = useState("");

  const handleUnlock = async () => {
    if (!uInput.trim() || !eInput.includes("@")) {
      setErrMsg("Please enter both your username and email address."); return;
    }
    setLoading(true); setErrMsg("");
    const { ok, requiresAdmin } = await unlockAccount(uInput, eInput);
    setLoading(false);
    if (ok) setResult("success");
    else if (requiresAdmin) setResult("admin");
    else setErrMsg("The username and email do not match. Please try again.");
  };

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"/>
      <div className="relative z-10 w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl"
        style={{animation:"fadeScaleIn .18s ease-out"}} onClick={e=>e.stopPropagation()}>

        {result === "success" && (
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center">
              <Unlock size={26} className="text-green-500"/>
            </div>
            <div>
              <h3 className="font-extrabold text-gray-900 text-lg">Account Unlocked!</h3>
              <p className="text-sm text-gray-500 mt-1">You can now log in with your password.</p>
            </div>
            <button onClick={onClose} className="w-full py-3 bg-blue-600 text-white rounded-full font-bold text-sm">
              Back to Login
            </button>
          </div>
        )}

        {result === "admin" && (
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center">
              <Lock size={26} className="text-amber-500"/>
            </div>
            <div>
              <h3 className="font-extrabold text-gray-900 text-lg">Admin Review Required</h3>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                Self-service unlock failed. Your account has been flagged for admin review. Please contact support to restore access.
              </p>
            </div>
            <button onClick={onClose} className="w-full py-3 bg-gray-200 text-gray-700 rounded-full font-bold text-sm">
              Close
            </button>
          </div>
        )}

        {result === "idle" && (
          <>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center">
                <Lock size={16} className="text-red-600"/>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">
                  {permanent ? "Permanently Locked" : "Unlock Your Account"}
                </p>
                <p className="text-xs text-gray-500">Verify your identity to restore access</p>
              </div>
            </div>

            {permanent && (
              <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 mb-4 text-xs text-red-700 leading-relaxed">
                Your account has been permanently locked due to repeated failed login attempts over 3 days. Verify your identity below to unlock.
              </div>
            )}

            {errMsg && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mb-3 flex gap-2 items-start">
                <AlertCircle size={12} className="text-red-500 flex-shrink-0 mt-0.5"/>
                <p className="text-red-600 text-xs">{errMsg}</p>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Username</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm pointer-events-none">@</span>
                  <input type="text" value={uInput}
                    onChange={e => setUInput(e.target.value.replace(/^@/,"").replace(/[^a-zA-Z0-9_]/g,""))}
                    placeholder="your_username"
                    className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                    autoCapitalize="none"/>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Email Address</label>
                <input type="email" value={eInput} onChange={e => setEInput(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"/>
              </div>
              <button onClick={handleUnlock} disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-full font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {loading ? <><Spinner/>Verifying…</> : <><Unlock size={14}/> Unlock Account</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════ */
export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>(1);

  /* ── login ── */
  const [loginId,      setLoginId]      = useState("");
  const [loginPass,    setLoginPass]    = useState("");
  const [showPass,     setShowPass]     = useState(false);
  const [loginErr,     setLoginErr]     = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showUnlock,   setShowUnlock]   = useState(false);
  const [unlockPerm,   setUnlockPerm]   = useState(false);

  /* ── step 2 state (declared early so hook can use anonUser) ── */
  const [anonUser,        setAnonUser]        = useState("");
  const [showAnonInfo,    setShowAnonInfo]     = useState(false);
  const [anonSuggestions, setAnonSuggestions] = useState<string[]>([]);
  const [regErr,          setRegErr]           = useState("");
  const [regLoading,      setRegLoading]       = useState(false);

  /* ── step 1 ── */
  const [name,        setName]        = useState("");
  const [username,    setUsername]    = useState("");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [showRegPass, setShowRegPass] = useState(false);
  const [showPassInfo,setShowPassInfo]= useState(false);
  const [dob,         setDob]         = useState("");
  const [gender,      setGender]      = useState("");
  const [country,     setCountry]     = useState("");
  const [phoneCode,   setPhoneCode]   = useState("+91");
  const [phoneNum,    setPhoneNum]    = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string,string>>({});
  const setFE = (key:string, msg:string|null) =>
    setFieldErrors(p=>{ const n={...p}; if(msg) n[key]=msg; else delete n[key]; return n; });

  /* suggestion seed */
  const [suggSeed, setSuggSeed] = useState(0);
  const { suggestions: usernameSuggestions, loading: suggsLoading } =
    useUsernameSuggestions(name, email, suggSeed);

  /* cross-availability */
  const userAvail = useCrossAvailability(username);
  const anonAvail = useCrossAvailability(anonUser);

  const maxDob = getMaxDob();

  useEffect(() => { if (step===2) setAnonSuggestions(generateAnonSuggestions()); }, [step]);

  /* ── INSTANT EMAIL CHECK — error (blocks), not warning ── */
  useEffect(() => {
    setFE("emailTaken", null);
    if (!email.includes("@") || email.trim().length < 5) return;
    const t = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("id")
        .eq("email", email.trim().toLowerCase()).maybeSingle();
      if (data) setFE("emailTaken", "This email is already registered. Please use a different email address.");
    }, 900);
    return () => clearTimeout(t);
  }, [email]);

  /* ── INSTANT PHONE CHECK ── */
  useEffect(() => {
    const digits = phoneNum.replace(/\s/g,"");
    if (!digits) { setFE("phone", null); return; }
    if (digits.length < 5) return;
    if (phoneCode==="+91" && !/^[6-9]/.test(digits)) {
      setFE("phone", "India numbers must start with 6, 7, 8, or 9"); return;
    }
    const t = setTimeout(async () => {
      const fullPhone = `${phoneCode}${digits}`;
      const { data } = await supabase.from("profiles").select("id")
        .eq("phone", fullPhone).maybeSingle();
      if (data) setFE("phone","This number is already linked to another account");
      else      setFE("phone", null);
    }, 900);
    return () => clearTimeout(t);
  }, [phoneNum, phoneCode]);

  const switchMode = (m: Mode) => {
    setMode(m); setStep(1); setRegErr(""); setLoginErr("");
    setFieldErrors({});
  };

  /* ── LOGIN ── */
  const handleLogin = async () => {
    setLoginErr("");
    if (!loginId.trim()) { setLoginErr("Please enter your email or username"); return; }
    if (!loginPass)       { setLoginErr("Please enter your password"); return; }
    setLoginLoading(true);
    const { error } = await signIn(loginId.trim(), loginPass);
    setLoginLoading(false);
    if (!error) { navigate("/feed"); return; }

    const msg = error.message;
    if (msg === "PERMANENTLY_LOCKED") {
      setUnlockPerm(true); setShowUnlock(true);
    } else if (msg.startsWith("LOCKED:")) {
      const hrs = msg.split(":")[1];
      setLoginErr(`Account locked for ${hrs} hour${hrs==="1"?"":"s"} due to too many failed attempts. Tap "Unlock Account" if you believe this is an error.`);
      setUnlockPerm(false); setShowUnlock(false);
    } else if (msg.startsWith("WRONG_PASSWORD:")) {
      const left = msg.split(":")[1];
      setLoginErr(`Incorrect password. ${left} attempt${left==="1"?"":"s"} remaining before your account is locked.`);
    } else if (msg === "Anonymous username cannot be used for login. Please use your regular username.") {
      setLoginErr(msg);
    } else {
      setLoginErr("Incorrect credentials — please check and try again.");
    }
  };

  /* ── VALIDATE STEP 1 ── */
  const validateStep1 = async (): Promise<boolean> => {
    const errs: Record<string,string> = {};

    if (!name.trim()) errs.name = "Full name is required";

    const u = username.replace(/^@/,"");
    if (u.includes("@"))                       errs.username = "3–20 characters (letters, numbers, underscore)";
    else if (!/^[a-zA-Z0-9_]{3,20}$/.test(u)) errs.username = "3–20 characters (letters, numbers, underscore)";
    else if (userAvail === "taken")            errs.username = "Username already taken";

    if (!email.includes("@"))  errs.email = "Enter a valid email address";
    else if (fieldErrors.emailTaken) errs.email = fieldErrors.emailTaken; // carry instant-check result

    // Re-check email in DB (in case instant check hadn't fired yet)
    if (!errs.email) {
      const { data: existingEmail } = await supabase.from("profiles").select("id")
        .eq("email", email.trim().toLowerCase()).maybeSingle();
      if (existingEmail) errs.email = "This email is already registered. Please use a different email address.";
    }

    if (!/(?=.*[a-zA-Z])(?=.*\d)(?=.*[\W_]).{8,14}/.test(password))
      errs.password = "Tap ℹ️ to see requirements";

    if (!dob || new Date(dob) > new Date(maxDob)) errs.dob = "Must be at least 14 years old";
    if (!gender)  errs.gender  = "Please select your gender";
    if (!country) errs.country = "Please select your country";

    if (phoneNum.trim()) {
      const digits = phoneNum.replace(/\s/g,"");
      if (!/^\d{5,10}$/.test(digits)) errs.phone = "Enter a valid phone number";
      else if (phoneCode==="+91" && !/^[6-9]/.test(digits)) errs.phone = "India numbers must start with 6, 7, 8, or 9";
      else if (fieldErrors.phone) errs.phone = fieldErrors.phone;
      else {
        const fullPhone = `${phoneCode}${digits}`;
        const { data } = await supabase.from("profiles").select("id").eq("phone",fullPhone).maybeSingle();
        if (data) errs.phone = "This number is already linked to another account";
      }
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ── VALIDATE STEP 2 ── */
  const validateStep2 = (): string|null => {
    const a = anonUser.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(a)) return "Anonymous username: 3–20 characters (letters, numbers, underscore)";
    if (anonAvail==="taken")              return "That anonymous username is already taken — try another";
    return null;
  };

  const goStep2 = async () => {
    const valid = await validateStep1();
    if (!valid) return;
    setRegErr(""); setStep(2); setShowAnonInfo(true);
  };

  /* ── REGISTER ── */
  const handleRegister = async () => {
    const err = validateStep2();
    if (err) { setRegErr(err); return; }
    setRegLoading(true); setRegErr("");

    const fullPhone = phoneNum.trim() ? `${phoneCode}${phoneNum.replace(/\s/g,"")}` : null;

    const { error } = await signUp({
      email, password, name,
      username:      username.replace(/^@/,"").toLowerCase(),
      anon_username: anonUser.trim(),
      gender, dob, language: ["en"], country,
      phone: fullPhone,
      is_org: false,
    });

    setRegLoading(false);
    if (error) {
      const msg = error.message || "";
      if (msg === "EMAIL_TAKEN") setRegErr("This email is already registered. Please use a different email address.");
      else if (msg.includes("already")||msg.includes("unique")) setRegErr("Email or username already taken.");
      else setRegErr(msg || "Something went wrong. Please try again.");
    } else navigate("/categories");
  };

  const inp = (err?: boolean) =>
    `w-full px-4 py-3.5 bg-gray-50 border rounded-full text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all text-gray-900 placeholder-gray-400 select-text ${err?"border-red-300 focus:border-red-400":"border-gray-200 focus:border-blue-400"}`;
  const lbl = "block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5";
  const btn = "w-full py-3.5 bg-blue-600 text-white rounded-full font-bold text-[15px] hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 transition-all shadow-md shadow-blue-200/50 flex items-center justify-center gap-2";

  return (
    <>
      <CentreModal show={showAnonInfo} onClose={()=>setShowAnonInfo(false)}
        title="Anonymous Identity" icon={<Shield size={16} className="text-blue-600"/>}>
        <p className="text-sm text-gray-600 leading-relaxed">
          Your anonymous username lets you post without revealing your real identity. Choose a name others can't trace back to you.
          <br/><br/>
          <strong className="text-gray-800">⚠️ Permanent — cannot be changed after registration.</strong><br/>
          <strong className="text-gray-800">🔒 Cannot be used for login.</strong>
        </p>
      </CentreModal>

      <CentreModal show={showPassInfo} onClose={()=>setShowPassInfo(false)}
        title="Password Requirements" icon={<Info size={16} className="text-blue-600"/>}>
        <ul className="text-sm text-gray-600 space-y-2.5">
          {["8 to 14 characters long","At least one letter (A-Z or a-z)","At least one number (0-9)","At least one symbol (! @ # $ % etc.)"].map(r=>(
            <li key={r} className="flex items-center gap-2.5">
              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0"><Check size={11} className="text-green-600"/></div>
              {r}
            </li>
          ))}
        </ul>
      </CentreModal>

      <UnlockModal show={showUnlock} onClose={()=>setShowUnlock(false)} permanent={unlockPerm}/>

      <div className="flex flex-col lg:flex-row bg-white select-none"
        style={{height:"100dvh",overflow:"hidden"}} onContextMenu={e=>e.preventDefault()}>

        {/* LEFT PANEL */}
        <div className="hidden lg:block flex-shrink-0 relative overflow-hidden" style={{width:"55%",height:"100dvh"}}>
          <img src="/login_icon.png" alt="" draggable={false} onContextMenu={e=>e.preventDefault()}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"/>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col" style={{height:"100dvh",overflow:"hidden"}}>

          {/* HEADER */}
          <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 lg:px-8">
            <div className="lg:hidden flex items-center py-3.5 relative">
              <div className="w-9 h-9 bg-blue-600 rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0 z-10">
                <span className="font-sphere text-white text-xl leading-none">s</span>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-sphere text-blue-600 text-xl leading-none">sphere</span>
                <span className="text-xs text-gray-400 font-medium mt-0.5">Your world. Your voice.</span>
              </div>
            </div>
            <div className="hidden lg:flex flex-col items-center py-5">
              <p className="font-sphere text-blue-600 text-3xl leading-none">sphere</p>
              <p className="text-xs text-gray-400 font-medium mt-1">Your world. Your voice.</p>
            </div>
            <div className="flex bg-gray-100 rounded-full p-1 mb-3 max-w-xs mx-auto lg:max-w-sm lg:mx-0">
              {(["login","register"] as Mode[]).map(m=>(
                <button key={m} onClick={()=>switchMode(m)}
                  className={`flex-1 py-2.5 rounded-full text-[15px] font-bold transition-all ${mode===m?"bg-white text-gray-900 shadow-sm":"text-gray-500"}`}>
                  {m==="login"?"Log In":"Register"}
                </button>
              ))}
            </div>
          </div>

          {/* SCROLL AREA */}
          <div className="flex-1 overflow-y-auto px-5 lg:px-8 pt-8 pb-2">
            <div className="w-full max-w-xs mx-auto lg:max-w-sm lg:mx-0">

              {/* ═══ LOGIN ═══ */}
              {mode==="login" && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-2xl font-extrabold text-gray-900">Welcome back 👋</h1>
                    <p className="text-[15px] text-gray-500 mt-1">Login to see your feed</p>
                  </div>
                  <div className="hidden lg:flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4">
                    <span className="text-2xl">🌏</span>
                    <div>
                      <p className="text-[15px] font-bold text-gray-800">India's social platform</p>
                      <p className="text-xs text-gray-500 mt-0.5">Local feeds · 10 languages · Anonymous mode</p>
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Email or Username</label>
                    <input type="text" value={loginId} onChange={e=>setLoginId(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                      placeholder="Email or username" className={inp()}
                      autoComplete="username" autoCapitalize="none"/>
                    <p className="text-xs text-gray-400 mt-1">You can type your username without @</p>
                  </div>
                  <div>
                    <label className={lbl}>Password</label>
                    <div className="relative">
                      <input type={showPass?"text":"password"} value={loginPass}
                        onChange={e=>setLoginPass(e.target.value)}
                        onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                        placeholder="Your password" className={inp()+" pr-20"} autoComplete="current-password"/>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button type="button" onClick={()=>setShowPassInfo(true)} className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-blue-500"><Info size={13}/></button>
                        <button type="button" onClick={()=>setShowPass(!showPass)} className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400">{showPass?<EyeOff size={14}/>:<Eye size={14}/>}</button>
                      </div>
                    </div>
                    <button type="button" onClick={()=>navigate("/forgot-password")}
                      className="text-xs text-blue-600 font-semibold mt-2 block">Forgot password?</button>
                  </div>
                  {loginErr&&(
                    <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex gap-2 items-start">
                      <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5"/>
                      <div className="flex-1">
                        <p className="text-red-600 text-[13px] font-medium">{loginErr}</p>
                        {loginErr.includes("Unlock Account") && (
                          <button onClick={()=>setShowUnlock(true)}
                            className="mt-2 flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">
                            <Unlock size={11}/> Unlock Account
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ═══ REGISTER ═══ */}
              {mode==="register" && (
                <>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{width:step===1?"50%":"100%"}}/>
                    </div>
                    <span className="text-xs font-bold text-gray-400 whitespace-nowrap">{step} of 2</span>
                  </div>

                  {/* STEP 1 */}
                  {step===1 && (
                    <div className="space-y-4">
                      <div className="mb-2">
                        <h1 className="text-xl font-extrabold text-gray-900">Create your account</h1>
                        <p className="text-[13px] text-gray-500 mt-0.5">Join sphere today</p>
                      </div>

                      {/* Full Name */}
                      <div>
                        <label className={lbl}>Full Name</label>
                        <FieldError msg={fieldErrors.name}/>
                        <input value={name} onChange={e=>{setName(e.target.value);setFE("name",null);}}
                          placeholder="Your full name" className={inp(!!fieldErrors.name)} autoComplete="name"/>
                      </div>

                      {/* Username */}
                      <div>
                        <label className={lbl}>Username</label>
                        <FieldError msg={fieldErrors.username}/>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm pointer-events-none">@</span>
                          <input value={username} maxLength={20}
                            onChange={e=>{setUsername(e.target.value.replace(/^@/,"").replace(/[^a-zA-Z0-9_]/g,""));setFE("username",null);}}
                            placeholder="your_username" className={inp(!!fieldErrors.username)+" pl-8"}
                            autoComplete="off" autoCapitalize="none"/>
                          {userAvail!=="idle"&&(
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                              {userAvail==="checking"&&<Loader2 size={12} className="text-gray-400 animate-spin"/>}
                              {userAvail==="ok"      &&<Check   size={13} className="text-green-500"/>}
                              {userAvail==="taken"   &&<X       size={13} className="text-red-500"/>}
                            </div>
                          )}
                        </div>
                        <AvailBadge state={userAvail}/>

                        {/* Suggestions */}
                        {(name.trim().length >= 2 || email.includes("@")) && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                                <Sparkles size={9}/> Suggestions — tap to use
                              </p>
                              <button type="button" onClick={()=>setSuggSeed(s=>s+1)}
                                className="flex items-center gap-1 text-[10px] text-blue-500 font-semibold hover:text-blue-700 transition-colors">
                                <RefreshCw size={9} className={suggsLoading?"animate-spin":""}/>
                                Suggest
                              </button>
                            </div>
                            {suggsLoading ? (
                              <div className="flex gap-1.5">
                                {[1,2,3].map(i=><div key={i} className="h-6 w-20 bg-gray-100 rounded-full animate-pulse"/>)}
                              </div>
                            ) : usernameSuggestions.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {usernameSuggestions.map(s=>(
                                  <button key={s} type="button"
                                    onClick={()=>{setUsername(s);setFE("username",null);}}
                                    className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-[11px] font-bold hover:bg-blue-100 transition-colors">
                                    @{s}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[10px] text-gray-400">No available suggestions — tap "Suggest" to try more</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Email */}
                      <div>
                        <label className={lbl}>Email</label>
                        <FieldError msg={fieldErrors.email || fieldErrors.emailTaken}/>
                        <input type="email" value={email}
                          onChange={e=>{setEmail(e.target.value);setFE("email",null);}}
                          placeholder="your@email.com"
                          className={inp(!!(fieldErrors.email||fieldErrors.emailTaken))} autoComplete="email"/>
                      </div>

                      {/* Password */}
                      <div>
                        <label className={lbl}>Password</label>
                        <FieldError msg={fieldErrors.password}/>
                        <div className="relative">
                          <input type={showRegPass?"text":"password"} value={password}
                            onChange={e=>{setPassword(e.target.value);setFE("password",null);}}
                            placeholder="Create a strong password"
                            className={inp(!!fieldErrors.password)+" pr-20"} autoComplete="new-password"/>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <button type="button" onClick={()=>setShowPassInfo(true)} className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-blue-500"><Info size={13}/></button>
                            <button type="button" onClick={()=>setShowRegPass(!showRegPass)} className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400">{showRegPass?<EyeOff size={14}/>:<Eye size={14}/>}</button>
                          </div>
                        </div>
                      </div>

                      {/* Phone — OPTIONAL */}
                      <div className="relative">
                        <label className={lbl}>
                          Phone Number
                          <span className="ml-1.5 text-[10px] font-normal normal-case text-gray-400">(optional)</span>
                        </label>
                        <FieldError msg={fieldErrors.phone}/>
                        <PhoneInput
                          dialCode={phoneCode}
                          onDialChange={c=>{setPhoneCode(c);setFE("phone",null);}}
                          number={phoneNum}
                          onNumberChange={n=>{setPhoneNum(n);setFE("phone",null);}}
                          hasError={!!fieldErrors.phone}
                        />
                      </div>

                      {/* DOB */}
                      <div>
                        <label className={lbl}>Date of Birth <span className="normal-case font-normal text-gray-400">(14+)</span></label>
                        <FieldError msg={fieldErrors.dob}/>
                        <input type="date" value={dob} max={maxDob}
                          onChange={e=>{setDob(e.target.value);setFE("dob",null);}}
                          className={inp(!!fieldErrors.dob)}/>
                      </div>

                      {/* Gender */}
                      <div>
                        <label className={lbl}>Gender</label>
                        <GenderSelect value={gender} onChange={v=>{setGender(v);setFE("gender",null);}} error={fieldErrors.gender}/>
                      </div>

                      {/* Country */}
                      <div>
                        <label className={lbl}>Country</label>
                        <CountrySelect value={country} onChange={v=>{setCountry(v);setFE("country",null);}} error={fieldErrors.country}/>
                      </div>
                    </div>
                  )}

                  {/* STEP 2 */}
                  {step===2 && (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                            <Shield size={17} className="text-blue-600"/> Anonymous Identity
                          </h1>
                          <p className="text-xs text-gray-500 mt-0.5">Your hidden posting persona</p>
                        </div>
                        <button type="button" onClick={()=>setShowAnonInfo(true)}
                          className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 hover:bg-blue-100">
                          <Info size={14}/>
                        </button>
                      </div>

                      <div>
                        <label className={lbl}>Anonymous Username</label>
                        <FieldError msg={anonAvail==="taken"?"Already taken — try another":null}/>
                        <div className="relative">
                          <input value={anonUser}
                            onChange={e=>setAnonUser(e.target.value.replace(/[^a-zA-Z0-9_]/g,""))}
                            placeholder="e.g. crimson_wolf42"
                            className={inp(anonAvail==="taken")} autoComplete="off" autoCapitalize="none" maxLength={20}/>
                          {anonAvail!=="idle"&&(
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                              {anonAvail==="checking"&&<Loader2 size={12} className="text-gray-400 animate-spin"/>}
                              {anonAvail==="ok"      &&<Check   size={13} className="text-green-500"/>}
                              {anonAvail==="taken"   &&<X       size={13} className="text-red-500"/>}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <p className="text-xs text-amber-600 font-semibold">⚠️ Permanent — cannot be changed &amp; cannot be used for login</p>
                          <AvailBadge state={anonAvail}/>
                        </div>

                        {anonSuggestions.length>0 && !anonUser && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[10px] text-gray-400 flex items-center gap-1"><Sparkles size={9}/> Suggestions — tap to use</p>
                              <button type="button" onClick={()=>setAnonSuggestions(generateAnonSuggestions())}
                                className="flex items-center gap-1 text-[10px] text-blue-500 font-semibold hover:text-blue-700">
                                <RefreshCw size={9}/> Suggest
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {anonSuggestions.map(s=>(
                                <button key={s} type="button" onClick={()=>setAnonUser(s)}
                                  className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-[11px] font-bold hover:bg-gray-200 transition-colors">
                                  {s}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {anonUser.trim().length>=1 && <AnonPostSkeleton anonUser={anonUser.trim()}/>}

                      {regErr&&(
                        <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex gap-2 items-center">
                          <AlertCircle size={14} className="text-red-500 flex-shrink-0"/>
                          <p className="text-red-600 text-xs font-medium">{regErr}</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* BOTTOM CTA */}
          <div className="flex-shrink-0 bg-white border-t border-gray-100 px-5 lg:px-8 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
            <div className="w-full max-w-xs mx-auto lg:max-w-sm lg:mx-0 flex flex-col gap-2">
              {mode==="login"&&(
                <button onClick={handleLogin} disabled={loginLoading} className={btn}>
                  {loginLoading?<><Spinner/>Logging in…</>:"Log In"}
                </button>
              )}
              {mode==="register"&&step===1&&(
                <button onClick={goStep2} className={btn}>Continue <ArrowRight size={15}/></button>
              )}
              {mode==="register"&&step===2&&(
                <div className="flex gap-3">
                  <button onClick={()=>{setStep(1);setRegErr("");}}
                    className="flex items-center gap-1.5 px-5 py-3.5 border-2 border-gray-200 rounded-full text-[15px] font-bold text-gray-600 hover:bg-gray-50 transition-all">
                    <ArrowLeft size={14}/> Back
                  </button>
                  <button onClick={handleRegister} disabled={regLoading} className={btn+" flex-1"}>
                    {regLoading?<><Spinner/>Creating…</>:"Create Account 🎉"}
                  </button>
                </div>
              )}
              <p className="text-center text-xs text-gray-400">
                {mode==="login"
                  ?<>Don't have an account? <button onClick={()=>switchMode("register")} className="text-blue-600 font-bold">Register</button></>
                  :<>Already have an account? <button onClick={()=>switchMode("login")} className="text-blue-600 font-bold">Log In</button></>}
              </p>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes fadeScaleIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}`}</style>
    </>
  );
}

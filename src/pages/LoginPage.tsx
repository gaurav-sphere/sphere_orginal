import React, {
  useState, useRef, useEffect, useCallback,
} from "react";
import { useNavigate } from "react-router";
import {
  Eye, EyeOff, ArrowLeft, ArrowRight,
  Shield, Info, X, ChevronDown, Check,
  AlertCircle, Loader2, Phone,
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
   INLINE FIELD ERROR
════════════════════════════════════════ */
function FieldError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-2.5 py-1.5 mb-1.5 text-red-600 text-[10px] font-semibold">
      <AlertCircle size={11} className="flex-shrink-0" />
      {msg}
    </div>
  );
}

/* ════════════════════════════════════════
   AVAILABILITY BADGE
════════════════════════════════════════ */
type AvailState = "idle" | "checking" | "ok" | "taken";
function AvailBadge({ state }: { state: AvailState }) {
  if (state === "idle") return null;
  if (state === "checking") return <span className="text-[10px] text-gray-400 mt-0.5">Checking…</span>;
  if (state === "ok")       return <span className="text-[10px] text-green-600 font-bold mt-0.5">✓ Available</span>;
  return <span className="text-[10px] text-red-500 font-bold mt-0.5">✗ Already taken</span>;
}

/* ════════════════════════════════════════
   COUNTRY DIAL CODES
════════════════════════════════════════ */
const DIAL_CODES = [
  { code: "+91",  country: "IN", label: "🇮🇳 +91"  },
  { code: "+1",   country: "US", label: "🇺🇸 +1"   },
  { code: "+44",  country: "GB", label: "🇬🇧 +44"  },
  { code: "+92",  country: "PK", label: "🇵🇰 +92"  },
  { code: "+880", country: "BD", label: "🇧🇩 +880" },
  { code: "+94",  country: "LK", label: "🇱🇰 +94"  },
  { code: "+977", country: "NP", label: "🇳🇵 +977" },
  { code: "+971", country: "AE", label: "🇦🇪 +971" },
  { code: "+966", country: "SA", label: "🇸🇦 +966" },
  { code: "+65",  country: "SG", label: "🇸🇬 +65"  },
  { code: "+60",  country: "MY", label: "🇲🇾 +60"  },
  { code: "+62",  country: "ID", label: "🇮🇩 +62"  },
  { code: "+63",  country: "PH", label: "🇵🇭 +63"  },
  { code: "+81",  country: "JP", label: "🇯🇵 +81"  },
  { code: "+82",  country: "KR", label: "🇰🇷 +82"  },
  { code: "+86",  country: "CN", label: "🇨🇳 +86"  },
  { code: "+61",  country: "AU", label: "🇦🇺 +61"  },
  { code: "+49",  country: "DE", label: "🇩🇪 +49"  },
  { code: "+33",  country: "FR", label: "🇫🇷 +33"  },
  { code: "+55",  country: "BR", label: "🇧🇷 +55"  },
  { code: "+7",   country: "RU", label: "🇷🇺 +7"   },
  { code: "+234", country: "NG", label: "🇳🇬 +234" },
  { code: "+27",  country: "ZA", label: "🇿🇦 +27"  },
  { code: "+20",  country: "EG", label: "🇪🇬 +20"  },
  { code: "+98",  country: "IR", label: "🇮🇷 +98"  },
  { code: "+90",  country: "TR", label: "🇹🇷 +90"  },
  { code: "+39",  country: "IT", label: "🇮🇹 +39"  },
  { code: "+34",  country: "ES", label: "🇪🇸 +34"  },
  { code: "+31",  country: "NL", label: "🇳🇱 +31"  },
  { code: "+64",  country: "NZ", label: "🇳🇿 +64"  },
];

/* ── Phone input with country code selector ── */
function PhoneInput({
  dialCode, onDialChange,
  number, onNumberChange,
  error,
}: {
  dialCode: string; onDialChange: (c: string) => void;
  number: string;   onNumberChange: (n: string) => void;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const sel = DIAL_CODES.find(d => d.code === dialCode);
  const filtered = DIAL_CODES.filter(d =>
    d.label.toLowerCase().includes(search.toLowerCase()) ||
    d.code.includes(search)
  );

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setSearch("");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref}>
      <FieldError msg={error ?? null} />
      <div className={`flex border rounded-full overflow-hidden bg-gray-50 transition-all focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 ${error ? "border-red-300" : "border-gray-200"}`}>
        {/* Dial code button */}
        <button type="button" onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 px-3 py-3 border-r border-gray-200 bg-gray-100 text-xs font-bold text-gray-700 hover:bg-gray-200 transition-colors flex-shrink-0 rounded-l-full">
          {sel?.label ?? dialCode}
          <ChevronDown size={11} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {/* Number input */}
        <input
          type="tel"
          inputMode="numeric"
          value={number}
          onChange={e => onNumberChange(e.target.value.replace(/[^\d\s\-]/g, ""))}
          placeholder="98765 43210"
          className="flex-1 px-3 py-3 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none select-text"
        />
      </div>
      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden"
          style={{ width: 220, maxHeight: 240 }}>
          <div className="p-2 border-b border-gray-100">
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search code…"
              className="w-full px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-full focus:outline-none select-text" />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 190 }}>
            {filtered.map(d => (
              <button key={d.code} type="button"
                onClick={() => { onDialChange(d.code); setOpen(false); setSearch(""); }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${dialCode === d.code ? "text-blue-600 font-bold bg-blue-50" : "text-gray-700"}`}>
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
   GENDER SELECT
════════════════════════════════════════ */
const GENDERS = [
  { value: "Male",               emoji: "👨" },
  { value: "Female",            emoji: "👩" },
  { value: "Prefer not to say", emoji: "🤐" },
];

function GenderSelect({ value, onChange, error }: {
  value: string; onChange: (v: string) => void; error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sel = GENDERS.find(g => g.value === value);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <FieldError msg={error ?? null} />
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 bg-gray-50 border rounded-full text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-100 select-text ${error ? "border-red-300" : "border-gray-200 focus:border-blue-400"}`}>
        {sel ? <span className="flex items-center gap-2 text-gray-900 font-medium"><span>{sel.emoji}</span>{sel.value}</span>
             : <span className="text-gray-400">Select gender</span>}
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 left-0 right-0 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 py-1 overflow-hidden">
          {GENDERS.map(g => (
            <button key={g.value} type="button" onClick={() => { onChange(g.value); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-gray-50 ${value === g.value ? "text-blue-600 font-bold bg-blue-50" : "text-gray-700"}`}>
              <span className="text-lg">{g.emoji}</span>{g.value}
              {value === g.value && <Check size={13} className="ml-auto text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   COUNTRY SELECT
════════════════════════════════════════ */
const COUNTRIES = [
  "India","Afghanistan","Bangladesh","Bhutan","China","Indonesia","Japan","Maldives",
  "Myanmar","Nepal","Pakistan","Philippines","Singapore","Sri Lanka","Thailand",
  "United Arab Emirates","Australia","Brazil","Canada","France","Germany","Italy",
  "Mexico","Netherlands","New Zealand","Nigeria","Russia","Saudi Arabia",
  "South Africa","South Korea","Spain","Turkey","Ukraine","United Kingdom","United States",
];

function CountrySelect({ value, onChange, error }: {
  value: string; onChange: (v: string) => void; error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const filtered = COUNTRIES.filter(c => c.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(""); }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <FieldError msg={error ?? null} />
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 bg-gray-50 border rounded-full text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-100 select-text ${error ? "border-red-300" : "border-gray-200 focus:border-blue-400"}`}>
        {value ? <span className="text-gray-900 font-medium">🌍 {value}</span>
               : <span className="text-gray-400">Select country</span>}
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 left-0 right-0 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden" style={{ maxHeight: 220 }}>
          <div className="p-2 border-b border-gray-100">
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search country…"
              className="w-full px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-100 select-text" />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 160 }}>
            {filtered.map(c => (
              <button key={c} type="button" onClick={() => { onChange(c); setOpen(false); setSearch(""); }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 ${value === c ? "text-blue-600 font-bold bg-blue-50" : "text-gray-700"}`}>
                {c}{value === c && <Check size={12} className="inline ml-2 text-blue-600" />}
              </button>
            ))}
            {filtered.length === 0 && <p className="text-center text-xs text-gray-400 py-4">No match</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   PIN DOTS
════════════════════════════════════════ */
interface PinDotsProps {
  label: string;
  pinValue: string;
  compareTo?: string;
  onChangeRef: React.MutableRefObject<string>;
  onChangeState: (v: string) => void;
  autoFocus?: boolean;
  inputId: string;
  onComplete?: () => void;
}

function PinDots({ label, pinValue, compareTo, onChangeRef, onChangeState, autoFocus, inputId, onComplete }: PinDotsProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 300);
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
    onChangeRef.current = v;
    onChangeState(v);
    if (v.length === 4 && onComplete) setTimeout(onComplete, 80);
  };

  const matchStatus: "idle" | "ok" | "bad" | null =
    compareTo !== undefined
      ? pinValue.length === 0 ? null
        : compareTo.length === pinValue.length
          ? pinValue === compareTo ? "ok" : "bad"
          : "idle"
      : null;

  return (
    <div className="flex flex-col items-center gap-2" onClick={() => inputRef.current?.focus()}>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</p>
      <div className="relative flex gap-3" style={{ cursor: "text" }}>
        {[0, 1, 2, 3].map(i => {
          const filled = !!pinValue[i];
          const isBad  = matchStatus === "bad" && compareTo !== undefined && compareTo[i] !== undefined && compareTo[i] !== pinValue[i];
          return (
            <div key={i} className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all ${
              filled
                ? isBad ? "bg-red-100 border-red-400"
                  : "bg-blue-600 border-blue-600 shadow-sm shadow-blue-200"
                : i === pinValue.length
                  ? "border-blue-400 bg-gray-50 animate-pulse"
                  : "border-gray-200 bg-gray-50"
            }`}>
              {filled && <svg width="8" height="8" viewBox="0 0 24 24" fill={isBad ? "#ef4444" : "white"}><circle cx="12" cy="12" r="6"/></svg>}
            </div>
          );
        })}
        <input
          ref={inputRef}
          id={inputId}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={pinValue}
          onChange={handleChange}
          autoComplete="one-time-code"
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            opacity: 0, fontSize: "16px", cursor: "text",
          }}
        />
      </div>
      <p className={`text-[10px] font-semibold ${matchStatus === "ok" ? "text-green-600" : matchStatus === "bad" ? "text-red-500" : "text-gray-400"}`}>
        {matchStatus === "ok" ? "✓ PINs match"
          : matchStatus === "bad" ? "✗ Doesn't match"
          : pinValue.length === 4 ? "✓ Done"
          : `${4 - pinValue.length} digit${4 - pinValue.length !== 1 ? "s" : ""} left`}
      </p>
    </div>
  );
}

/* ════════════════════════════════════════
   CENTRED MODAL
════════════════════════════════════════ */
function CentreModal({ show, onClose, title, icon, children }: {
  show: boolean; onClose: () => void; title: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl"
        style={{ animation: "fadeScaleIn .18s ease-out" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">{icon}</div>
            <p className="font-bold text-gray-900 text-sm">{title}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center">
            <X size={13} className="text-gray-600" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Spinner() {
  return <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
  </svg>;
}

/* ════════════════════════════════════════
   LIVE AVAILABILITY CHECK
════════════════════════════════════════ */
function useAvailability(value: string, table: "profiles", column: "username" | "anon_username") {
  const [state, setState] = useState<AvailState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timerRef.current);
    const clean = value.replace(/^@/, "").trim();
    if (clean.length < 3) { setState("idle"); return; }
    setState("checking");
    timerRef.current = setTimeout(async () => {
      const { data } = await supabase.from(table).select("id").eq(column, clean).maybeSingle();
      setState(data ? "taken" : "ok");
    }, 600);
    return () => clearTimeout(timerRef.current);
  }, [value, table, column]);

  return state;
}

/* ════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════ */
export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>(1);

  /* login */
  const [loginId,      setLoginId]      = useState("");
  const [loginPass,    setLoginPass]    = useState("");
  const [showPass,     setShowPass]     = useState(false);
  const [loginErr,     setLoginErr]     = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  /* register step 1 */
  const [name,         setName]         = useState("");
  const [username,     setUsername]     = useState("");
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showRegPass,  setShowRegPass]  = useState(false);
  const [showPassInfo, setShowPassInfo] = useState(false);
  const [dob,          setDob]          = useState("");
  const [gender,       setGender]       = useState("");
  const [country,      setCountry]      = useState("");
  /* Phone: separate dial code + number, combined on submit */
  const [phoneCode,    setPhoneCode]    = useState("+91");
  const [phoneNum,     setPhoneNum]     = useState("");

  /* register step 2 */
  const [anonUser,      setAnonUser]   = useState("");
  const [pin,           setPin]        = useState("");
  const [pinConfirm,    setPinConfirm] = useState("");
  const pinRef        = useRef("");
  const pinConfirmRef = useRef("");

  const [showAnonInfo, setShowAnonInfo] = useState(false);
  const [regErr,       setRegErr]       = useState("");
  const [regLoading,   setRegLoading]   = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const setFE = (key: string, msg: string | null) =>
    setFieldErrors(p => { const n = { ...p }; if (msg) n[key] = msg; else delete n[key]; return n; });

  const userAvail = useAvailability(username, "profiles", "username");
  const anonAvail = useAvailability(anonUser,  "profiles", "anon_username");

  const maxDob = getMaxDob();

  const switchMode = (m: Mode) => {
    setMode(m); setStep(1); setRegErr(""); setLoginErr("");
    setFieldErrors({});
    setPin(""); setPinConfirm(""); pinRef.current = ""; pinConfirmRef.current = "";
  };

  /* ── Login ── */
  const handleLogin = async () => {
    setLoginErr("");
    if (!loginId.trim()) { setLoginErr("Please enter your email or username"); return; }
    if (!loginPass)       { setLoginErr("Please enter your password"); return; }
    setLoginLoading(true);
    const { error } = await signIn(loginId.trim(), loginPass);
    setLoginLoading(false);
    if (error) setLoginErr("Incorrect credentials — please check and try again.");
    else navigate("/feed");
  };

  /* ── Validate step 1 ── */
  const validateStep1 = async (): Promise<boolean> => {
    const errs: Record<string, string> = {};
    if (!name.trim())                             errs.name = "Full name is required";
    const u = username.replace(/^@/, "");
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(u))         errs.username = "3–20 chars (letters, numbers, underscore)";
    else if (userAvail === "taken")               errs.username = "Username already taken";
    if (!email.includes("@"))                     errs.email = "Enter a valid email address";
    if (!/(?=.*[a-zA-Z])(?=.*\d)(?=.*[\W_]).{8,14}/.test(password)) errs.password = "Tap ℹ️ to see requirements";
    if (!dob || new Date(dob) > new Date(maxDob)) errs.dob = "Must be at least 14 years old";
    if (!gender)                                  errs.gender = "Please select your gender";
    if (!country)                                 errs.country = "Please select your country";

    /* Phone is now REQUIRED */
    if (!phoneNum.trim()) {
      errs.phone = "Phone number is required";
    } else if (!/^\d{6,14}$/.test(phoneNum.replace(/\s/g, ""))) {
      errs.phone = "Enter a valid phone number (digits only)";
    } else {
      /* Check phone uniqueness in database */
      const fullPhone = `${phoneCode}${phoneNum.replace(/\s/g, "")}`;
      const { data: existingPhone } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone", fullPhone)
        .maybeSingle();
      if (existingPhone) errs.phone = "An account with this phone number already exists";
    }

    /* Check email uniqueness in database */
    if (!errs.email) {
      const { data: existingEmail } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();
      if (existingEmail) errs.email = "An account with this email already exists";
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ── Validate step 2 ── */
  const validateStep2 = (): string | null => {
    if (!/^[a-zA-Z0-9_]{6,12}$/.test(anonUser.trim()))
      return "Anonymous username: 6–12 characters (letters, numbers, underscore)";
    if (anonAvail === "taken")
      return "That anonymous username is already taken — try another";
    const p1 = pinRef.current;
    const p2 = pinConfirmRef.current;
    if (p1.length !== 4) return "Please create a 4-digit PIN";
    if (p2.length !== 4) return "Please confirm your 4-digit PIN";
    if (p1 !== p2)       return "PINs don't match — please re-enter";
    return null;
  };

  const goStep2 = async () => {
    const valid = await validateStep1();
    if (!valid) return;
    setRegErr("");
    setPin(""); setPinConfirm("");
    pinRef.current = ""; pinConfirmRef.current = "";
    setStep(2); setShowAnonInfo(true);
  };

  /* ── Register ── FIXED: was missing `await signUp(` ── */
  const handleRegister = async () => {
    const err = validateStep2();
    if (err) { setRegErr(err); return; }
    setRegLoading(true); setRegErr("");

    const fullPhone = `${phoneCode}${phoneNum.replace(/\s/g, "")}`;

    // ✅ FIXED: `await signUp({` — was accidentally written as just `({`
    const { error } = await signUp({
      email,
      password,
      name,
      username: username.replace(/^@/, "").toLowerCase(),
      anon_username: anonUser.trim(),
      anon_pin: pinRef.current,
      gender,
      dob,
      language: ["en"],
      country,
      phone: fullPhone,
      is_org: false,
    });

    setRegLoading(false);
    if (error) {
      const msg = error.message || "";
      if (msg.includes("already") || msg.includes("unique")) setRegErr("Email or username already taken.");
      else setRegErr(msg || "Something went wrong. Please try again.");
    } else navigate("/categories");
  };

  /* ── Shared styles ── */
  const inp = (err?: boolean) =>
    `w-full px-4 py-3 bg-gray-50 border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all text-gray-900 placeholder-gray-400 select-text ${err ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-blue-400"}`;
  const lbl = "block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1";
  const btn = "w-full py-3.5 bg-blue-600 text-white rounded-full font-bold text-sm hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 transition-all shadow-md shadow-blue-200/50 flex items-center justify-center gap-2";

  return (
    <>
      <CentreModal show={showAnonInfo} onClose={() => setShowAnonInfo(false)}
        title="Anonymous Identity" icon={<Shield size={16} className="text-blue-600"/>}>
        <p className="text-sm text-gray-600 leading-relaxed">
          Your anonymous username lets you post without revealing your real identity.
          Choose a name others can't trace back to you.
          <br/><br/>
          Your 4-digit PIN protects anonymous posting — keep it safe.{" "}
          <strong className="text-gray-800">This username cannot be changed later.</strong>
        </p>
      </CentreModal>

      <CentreModal show={showPassInfo} onClose={() => setShowPassInfo(false)}
        title="Password Requirements" icon={<Info size={16} className="text-blue-600"/>}>
        <ul className="text-sm text-gray-600 space-y-2.5">
          {["8 to 14 characters long","At least one letter (A-Z or a-z)","At least one number (0-9)","At least one symbol (! @ # $ % etc.)"].map(r => (
            <li key={r} className="flex items-center gap-2.5">
              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Check size={11} className="text-green-600"/>
              </div>
              {r}
            </li>
          ))}
        </ul>
      </CentreModal>

      <div className="flex flex-col lg:flex-row bg-white select-none"
        style={{ height: "100dvh", overflow: "hidden" }}
        onContextMenu={e => e.preventDefault()}>

        {/* LEFT PANEL — desktop image only */}
        <div className="hidden lg:block flex-shrink-0 relative overflow-hidden" style={{ width: "55%", height: "100dvh" }}>
          <img src="/login_icon.png" alt="" draggable={false}
            onContextMenu={e => e.preventDefault()}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"/>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col" style={{ height: "100dvh", overflow: "hidden" }}>

          {/* STICKY HEADER */}
          <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 lg:px-8">
            {/* Mobile */}
            <div className="lg:hidden flex items-center py-3 relative">
              <div className="w-9 h-9 bg-blue-600 rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0 z-10">
                <span className="font-sphere text-white text-xl leading-none">s</span>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-sphere text-blue-600 text-xl leading-none">sphere</span>
                <span className="text-[10px] text-gray-400 font-medium mt-0.5">Your world. Your voice.</span>
              </div>
            </div>
            {/* Desktop */}
            <div className="hidden lg:flex flex-col items-center py-5">
              <p className="font-sphere text-blue-600 text-3xl leading-none">sphere</p>
              <p className="text-[11px] text-gray-400 font-medium mt-1">Your world. Your voice.</p>
            </div>
            {/* Tabs */}
            <div className="flex bg-gray-100 rounded-full p-1 mb-3 max-w-xs mx-auto lg:max-w-sm lg:mx-0">
              {(["login","register"] as Mode[]).map(m => (
                <button key={m} onClick={() => switchMode(m)}
                  className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${mode === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
                  {m === "login" ? "Log In" : "Register"}
                </button>
              ))}
            </div>
          </div>

          {/* SCROLLABLE CONTENT */}
          <div className="flex-1 overflow-y-auto px-5 lg:px-8 pt-5 pb-2">
            <div className="w-full max-w-xs mx-auto lg:max-w-sm lg:mx-0">

              {/* ════ LOGIN ════ */}
              {mode === "login" && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-2xl font-extrabold text-gray-900">Welcome back 👋</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Login to see your feed</p>
                  </div>
                  <div className="hidden lg:flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4">
                    <span className="text-2xl">🌏</span>
                    <div>
                      <p className="text-sm font-bold text-gray-800">India's social platform</p>
                      <p className="text-xs text-gray-500 mt-0.5">Local feeds · 9 languages · Anonymous mode</p>
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Email or Username</label>
                    <input type="text" value={loginId} onChange={e => setLoginId(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleLogin()}
                      placeholder="Email or username" className={inp()}
                      autoComplete="username" autoCapitalize="none"/>
                    <p className="text-[10px] text-gray-400 mt-1">You can type your username without @</p>
                  </div>
                  <div>
                    <label className={lbl}>Password</label>
                    <div className="relative">
                      <input type={showPass ? "text" : "password"} value={loginPass}
                        onChange={e => setLoginPass(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleLogin()}
                        placeholder="Your password" className={inp() + " pr-20"}
                        autoComplete="current-password"/>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button type="button" onClick={() => setShowPassInfo(true)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-blue-500">
                          <Info size={13}/>
                        </button>
                        <button type="button" onClick={() => setShowPass(!showPass)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400">
                          {showPass ? <EyeOff size={14}/> : <Eye size={14}/>}
                        </button>
                      </div>
                    </div>
                    <button type="button" onClick={() => navigate("/forgot-password")}
                      className="text-[11px] text-blue-600 font-semibold mt-1.5 block">Forgot password?</button>
                  </div>
                  {loginErr && (
                    <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex gap-2 items-start">
                      <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5"/>
                      <p className="text-red-600 text-xs font-medium">{loginErr}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ════ REGISTER ════ */}
              {mode === "register" && (
                <>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{ width: step === 1 ? "50%" : "100%" }}/>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">{step} of 2</span>
                  </div>

                  {/* STEP 1 */}
                  {step === 1 && (
                    <div className="space-y-3">
                      <div className="mb-2">
                        <h1 className="text-xl font-extrabold text-gray-900">Create your account</h1>
                        <p className="text-xs text-gray-500 mt-0.5">Join sphere today</p>
                      </div>

                      {/* Full Name */}
                      <div>
                        <label className={lbl}>Full Name</label>
                        <FieldError msg={fieldErrors.name}/>
                        <input value={name} onChange={e => { setName(e.target.value); setFE("name", null); }}
                          placeholder="Your full name" className={inp(!!fieldErrors.name)} autoComplete="name"/>
                      </div>

                      {/* Username */}
                      <div>
                        <label className={lbl}>Username</label>
                        <FieldError msg={fieldErrors.username}/>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm pointer-events-none">@</span>
                          <input value={username} maxLength={20}
                            onChange={e => { setUsername(e.target.value.replace(/^@/, "").replace(/[^a-zA-Z0-9_]/g, "")); setFE("username", null); }}
                            placeholder="your_name" className={inp(!!fieldErrors.username) + " pl-8"}
                            autoComplete="off" autoCapitalize="none"/>
                          {userAvail !== "idle" && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                              {userAvail === "checking" && <Loader2 size={12} className="text-gray-400 animate-spin"/>}
                              {userAvail === "ok"       && <Check size={13} className="text-green-500"/>}
                              {userAvail === "taken"    && <X size={13} className="text-red-500"/>}
                            </div>
                          )}
                        </div>
                        <AvailBadge state={userAvail}/>
                      </div>

                      {/* Email */}
                      <div>
                        <label className={lbl}>Email</label>
                        <FieldError msg={fieldErrors.email}/>
                        <input type="email" value={email}
                          onChange={e => { setEmail(e.target.value); setFE("email", null); }}
                          placeholder="your@email.com" className={inp(!!fieldErrors.email)} autoComplete="email"/>
                      </div>

                      {/* Password */}
                      <div>
                        <label className={lbl}>Password</label>
                        <FieldError msg={fieldErrors.password}/>
                        <div className="relative">
                          <input type={showRegPass ? "text" : "password"} value={password}
                            onChange={e => { setPassword(e.target.value); setFE("password", null); }}
                            placeholder="Create a strong password"
                            className={inp(!!fieldErrors.password) + " pr-20"} autoComplete="new-password"/>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <button type="button" onClick={() => setShowPassInfo(true)}
                              className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-blue-500">
                              <Info size={13}/>
                            </button>
                            <button type="button" onClick={() => setShowRegPass(!showRegPass)}
                              className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400">
                              {showRegPass ? <EyeOff size={14}/> : <Eye size={14}/>}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Phone — REQUIRED, with country dial code */}
                      <div className="relative">
                        <label className={lbl}>
                          Phone Number
                          <span className="ml-1 text-red-500">*</span>
                        </label>
                        <PhoneInput
                          dialCode={phoneCode}
                          onDialChange={c => { setPhoneCode(c); setFE("phone", null); }}
                          number={phoneNum}
                          onNumberChange={n => { setPhoneNum(n); setFE("phone", null); }}
                          error={fieldErrors.phone}
                        />
                        <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                          <Phone size={9}/> One account per phone number
                        </p>
                      </div>

                      {/* DOB */}
                      <div>
                        <label className={lbl}>Date of Birth <span className="normal-case font-normal text-gray-400">(14+)</span></label>
                        <FieldError msg={fieldErrors.dob}/>
                        <input type="date" value={dob} max={maxDob}
                          onChange={e => { setDob(e.target.value); setFE("dob", null); }}
                          className={inp(!!fieldErrors.dob)}/>
                      </div>

                      {/* Gender */}
                      <div>
                        <label className={lbl}>Gender</label>
                        <GenderSelect value={gender} onChange={v => { setGender(v); setFE("gender", null); }} error={fieldErrors.gender}/>
                      </div>

                      {/* Country */}
                      <div>
                        <label className={lbl}>Country</label>
                        <CountrySelect value={country} onChange={v => { setCountry(v); setFE("country", null); }} error={fieldErrors.country}/>
                      </div>
                    </div>
                  )}

                  {/* STEP 2 */}
                  {step === 2 && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                            <Shield size={17} className="text-blue-600"/> Anonymous Identity
                          </h1>
                          <p className="text-xs text-gray-500 mt-0.5">Your hidden posting persona</p>
                        </div>
                        <button type="button" onClick={() => setShowAnonInfo(true)}
                          className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 hover:bg-blue-100">
                          <Info size={14}/>
                        </button>
                      </div>

                      {/* Anon username */}
                      <div>
                        <label className={lbl}>Anonymous Username</label>
                        <FieldError msg={anonAvail === "taken" ? "Already taken — try another" : null}/>
                        <div className="relative">
                          <input value={anonUser}
                            onChange={e => setAnonUser(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                            placeholder="shadow_voice_77 (6–12 chars)"
                            className={inp(anonAvail === "taken")} autoComplete="off" autoCapitalize="none" maxLength={12}/>
                          {anonAvail !== "idle" && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                              {anonAvail === "checking" && <Loader2 size={12} className="text-gray-400 animate-spin"/>}
                              {anonAvail === "ok"       && <Check size={13} className="text-green-500"/>}
                              {anonAvail === "taken"    && <X size={13} className="text-red-500"/>}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[10px] text-gray-400">⚠️ Permanent — cannot be changed</p>
                          <AvailBadge state={anonAvail}/>
                        </div>
                      </div>

                      <PinDots
                        label="Create 4-digit PIN"
                        inputId="pin-create"
                        pinValue={pin}
                        onChangeRef={pinRef}
                        onChangeState={setPin}
                        autoFocus
                        onComplete={() => setTimeout(() => document.getElementById("pin-confirm")?.focus(), 120)}
                      />

                      <PinDots
                        label="Confirm PIN"
                        inputId="pin-confirm"
                        pinValue={pinConfirm}
                        compareTo={pin}
                        onChangeRef={pinConfirmRef}
                        onChangeState={setPinConfirm}
                      />

                      {regErr && (
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

          {/* FIXED BOTTOM CTA */}
          <div className="flex-shrink-0 bg-white border-t border-gray-100 px-5 lg:px-8 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
            <div className="w-full max-w-xs mx-auto lg:max-w-sm lg:mx-0 flex flex-col gap-2">
              {mode === "login" && (
                <button onClick={handleLogin} disabled={loginLoading} className={btn}>
                  {loginLoading ? <><Spinner/>Logging in…</> : "Log In"}
                </button>
              )}
              {mode === "register" && step === 1 && (
                <button onClick={goStep2} className={btn}>Continue <ArrowRight size={15}/></button>
              )}
              {mode === "register" && step === 2 && (
                <div className="flex gap-3">
                  <button onClick={() => { setStep(1); setRegErr(""); setPin(""); setPinConfirm(""); pinRef.current = ""; pinConfirmRef.current = ""; }}
                    className="flex items-center gap-1.5 px-5 py-3.5 border-2 border-gray-200 rounded-full text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all">
                    <ArrowLeft size={14}/> Back
                  </button>
                  <button onClick={handleRegister} disabled={regLoading} className={btn + " flex-1"}>
                    {regLoading ? <><Spinner/>Creating…</> : "Create Account 🎉"}
                  </button>
                </div>
              )}
              <p className="text-center text-[11px] text-gray-400">
                {mode === "login"
                  ? <>Don't have an account? <button onClick={() => switchMode("register")} className="text-blue-600 font-bold">Register</button></>
                  : <>Already have an account? <button onClick={() => switchMode("login")} className="text-blue-600 font-bold">Log In</button></>}
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeScaleIn {
          from { opacity:0; transform:scale(.92); }
          to   { opacity:1; transform:scale(1); }
        }
      `}</style>
    </>
  );
}

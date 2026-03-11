import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Eye, EyeOff, ArrowLeft, ArrowRight,
  Shield, Info, X, ChevronDown, Check,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

type Mode = "login" | "register";
type Step = 1 | 2;

/* ── Max DOB: enforce 14+ ── */
function getMaxDob(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 14);
  return d.toISOString().split("T")[0];
}

/* ════════════════════════════════════════════
   GENDER DROPDOWN (cylindrical, top-mount)
════════════════════════════════════════════ */
const GENDERS = [
  { value: "Male",              emoji: "👨" },
  { value: "Female",            emoji: "👩" },
  { value: "Non-binary",        emoji: "🧑" },
  { value: "Prefer not to say", emoji: "🤐" },
];

function GenderSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sel = GENDERS.find((g) => g.value === value);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-full text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
      >
        {sel ? (
          <span className="flex items-center gap-2 text-gray-900 font-medium">
            <span className="text-base">{sel.emoji}</span>{sel.value}
          </span>
        ) : (
          <span className="text-gray-400">Select gender</span>
        )}
        <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown opens ABOVE on mobile if near bottom, here we open upward by default */}
      {open && (
        <div className="absolute bottom-full mb-1 left-0 right-0 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 py-1 overflow-hidden">
          {GENDERS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => { onChange(g.value); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-gray-50 ${
                value === g.value ? "text-blue-600 font-bold bg-blue-50" : "text-gray-700"
              }`}
            >
              <span className="text-lg">{g.emoji}</span>
              <span>{g.value}</span>
              {value === g.value && <Check size={13} className="ml-auto text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   PIN DOTS — small circles + star fill
════════════════════════════════════════════ */
interface PinDotsProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onComplete?: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}
function PinDots({ label, value, onChange, onComplete, inputRef: extRef }: PinDotsProps) {
  const localRef = useRef<HTMLInputElement>(null);
  const ref = extRef ?? localRef;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
    onChange(v);
    if (v.length === 4 && onComplete) setTimeout(onComplete, 80);
  };

  return (
    <div className="flex flex-col items-center gap-2.5" onClick={() => ref.current?.focus()}>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</p>
      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${
              value[i]
                ? "bg-blue-600 border-blue-600 shadow-sm shadow-blue-200"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            {value[i] && (
              /* mini star */
              <svg width="9" height="9" viewBox="0 0 24 24" fill="white">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
              </svg>
            )}
          </div>
        ))}
      </div>
      <input
        ref={ref}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={value}
        onChange={handleChange}
        className="w-1 h-1 opacity-0 absolute pointer-events-none"
        autoComplete="one-time-code"
      />
    </div>
  );
}

/* ════════════════════════════════════════════
   ANON INFO MODAL
════════════════════════════════════════════ */
function AnonInfoModal({ show, onClose }: { show: boolean; onClose: () => void }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-sm bg-white rounded-t-3xl p-6 shadow-2xl mb-0"
        style={{ animation: "slideUp .25s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <Shield size={14} className="text-blue-600" />
          </div>
          <p className="font-bold text-gray-900 text-sm">Anonymous Identity</p>
          <button onClick={onClose} className="ml-auto w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center">
            <X size={12} className="text-gray-500" />
          </button>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          Your anonymous username lets you post without revealing your real identity.
          Choose a name that gives nothing away.
          <br /><br />
          Your 4-digit PIN is your key to posting anonymously — keep it safe.{" "}
          <strong className="text-gray-800">This username cannot be changed later.</strong>
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   SPINNER
════════════════════════════════════════════ */
function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

/* ════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════ */
export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>(1);

  /* login */
  const [loginId, setLoginId]           = useState("");
  const [loginPass, setLoginPass]       = useState("");
  const [showPass, setShowPass]         = useState(false);
  const [loginErr, setLoginErr]         = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  /* register step 1 */
  const [name, setName]               = useState("");
  const [username, setUsername]       = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [showRegPass, setShowRegPass] = useState(false);
  const [dob, setDob]                 = useState("");
  const [gender, setGender]           = useState("");

  /* register step 2 */
  const [anonUser, setAnonUser]         = useState("");
  const [pin, setPin]                   = useState("");
  const [pinConfirm, setPinConfirm]     = useState("");
  const [showAnonInfo, setShowAnonInfo] = useState(true);

  const [regErr, setRegErr]           = useState("");
  const [regLoading, setRegLoading]   = useState(false);

  const confirmPinRef = useRef<HTMLInputElement>(null);
  const maxDob = getMaxDob();

  const switchMode = (m: Mode) => {
    setMode(m); setStep(1); setRegErr(""); setLoginErr("");
    setPin(""); setPinConfirm(""); setAnonUser("");
  };

  /* ── Login ── */
  const handleLogin = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!loginId.trim() || !loginPass) { setLoginErr("Please fill all fields"); return; }
    setLoginLoading(true); setLoginErr("");
    const { error } = await signIn(loginId.trim(), loginPass);
    setLoginLoading(false);
    if (error) setLoginErr("Incorrect credentials. Please check and try again.");
    else navigate("/feed");
  }, [loginId, loginPass, signIn, navigate]);

  /* ── Step 1 validation ── */
  const validateStep1 = () => {
    if (!name.trim())   return "Full name is required";
    if (!/^[a-zA-Z0-9_]{3,14}$/.test(username.replace(/^@/, "")))
      return "Username: 3–14 chars (letters, numbers, underscore)";
    if (!email.includes("@")) return "Enter a valid email";
    if (!/(?=.*[a-zA-Z])(?=.*\d)(?=.*[\W_]).{8,14}/.test(password))
      return "Password: 8–14 chars with letter, number & symbol";
    if (!dob || new Date(dob) > new Date(maxDob))
      return "You must be at least 14 years old to join";
    if (!gender) return "Please select your gender";
    return null;
  };

  /* ── Step 2 validation ── */
  const validateStep2 = () => {
    if (!/^[a-zA-Z0-9_]{6,12}$/.test(anonUser))
      return "Anonymous username: 6–12 chars (letters/numbers/underscore)";
    if (pin.length !== 4) return "PIN must be exactly 4 digits";
    if (pin !== pinConfirm) return "PINs don't match — try again";
    return null;
  };

  const goStep2 = () => {
    const err = validateStep1();
    if (err) { setRegErr(err); return; }
    setRegErr(""); setStep(2); setShowAnonInfo(true);
  };

  const handleRegister = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const err = validateStep2();
    if (err) { setRegErr(err); return; }
    setRegLoading(true); setRegErr("");
    const { error } = await signUp({
      email, password, name,
      username: username.replace(/^@/, "").toLowerCase(),
      anon_username: anonUser,
      anon_pin: pin,
      gender, dob,
      language: ["en"],
      is_org: false,
    });
    setRegLoading(false);
    if (error) {
      const msg = error.message || "";
      if (msg.includes("already registered") || msg.includes("already exists"))
        setRegErr("That email or username is already taken.");
      else setRegErr(msg || "Something went wrong. Please try again.");
    } else {
      navigate("/categories");
    }
  }, [email, password, name, username, anonUser, pin, gender, dob, signUp, navigate]);

  /* ── Styles ── */
  const inputCls =
    "w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-full text-sm " +
    "focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 " +
    "transition-all text-gray-900 placeholder-gray-400";
  const labelCls = "block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5";
  const btnBlue =
    "w-full py-3.5 bg-blue-600 text-white rounded-full font-bold text-sm " +
    "hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 transition-all " +
    "shadow-md shadow-blue-200/50 flex items-center justify-center gap-2";

  /* ═══════════════════════════════════════════════════════════ */
  return (
    <div
      className="flex flex-col lg:flex-row bg-white"
      style={{ height: "100dvh", overflow: "hidden" }}
    >
      {/* ══════════════════════════════════════════
          LEFT PANEL — Desktop 55% — image only, fixed, no scroll
      ══════════════════════════════════════════ */}
      <div
        className="hidden lg:block flex-shrink-0 relative overflow-hidden"
        style={{ width: "55%", height: "100dvh" }}
      >
        <img
          src="/src/img/login_page_img/login_icon.jpg"
          alt="Sphere"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
          draggable={false}
        />
      </div>

      {/* ══════════════════════════════════════════
          RIGHT PANEL — 100% mobile / 45% desktop
      ══════════════════════════════════════════ */}
      <div
        className="flex-1 flex flex-col"
        style={{ height: "100dvh", overflow: "hidden" }}
      >
        {/* ── STICKY HEADER ── */}
        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-5 lg:px-8">
          {/* Mobile: logo + tagline centred */}
          <div className="lg:hidden flex flex-col items-center justify-center py-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-2xl flex items-center justify-center shadow-sm">
                <span className="font-sphere text-white text-lg leading-none">s</span>
              </div>
              <span className="font-sphere text-blue-600 text-xl">sphere</span>
            </div>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">Your world. Your voice.</p>
          </div>

          {/* Desktop: logo left */}
          <div className="hidden lg:flex items-center gap-2.5 py-4">
            <div className="w-9 h-9 bg-blue-600 rounded-2xl flex items-center justify-center shadow-sm">
              <span className="font-sphere text-white text-xl leading-none">s</span>
            </div>
            <div>
              <p className="font-sphere text-blue-600 text-2xl leading-none">sphere</p>
              <p className="text-[10px] text-gray-400 font-medium">Your world. Your voice.</p>
            </div>
          </div>

          {/* Mode tabs — fixed in header, never jumps */}
          <div className="flex bg-gray-100 rounded-full p-1 mb-3 max-w-xs mx-auto lg:max-w-sm lg:mx-0">
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${
                  mode === m
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {m === "login" ? "Log In" : "Register"}
              </button>
            ))}
          </div>
        </div>

        {/* ── SCROLLABLE CONTENT ── */}
        <div className="flex-1 overflow-y-auto px-5 lg:px-8 pt-5 pb-2">
          <div className="w-full max-w-xs mx-auto lg:max-w-sm lg:mx-0">

            {/* ════════ LOGIN ════════ */}
            {mode === "login" && (
              <div className="space-y-4">
                {/* Welcome back */}
                <div>
                  <h1 className="text-2xl font-extrabold text-gray-900">Welcome back 👋</h1>
                  <p className="text-sm text-gray-500 mt-0.5">Login to see your feed</p>
                </div>

                {/* Desktop extra info card */}
                <div className="hidden lg:flex items-center gap-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4">
                  <span className="text-3xl">🌏</span>
                  <div>
                    <p className="text-sm font-bold text-gray-800">India's social platform</p>
                    <p className="text-xs text-gray-500 mt-0.5">Local feeds · 9 languages · Anonymous mode</p>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Email or Username</label>
                  <input
                    type="text"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    placeholder="Email or username"
                    className={inputCls}
                    autoComplete="username"
                    autoCapitalize="none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    You can type your username without @
                  </p>
                </div>

                <div>
                  <label className={labelCls}>Password</label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                      placeholder="Your password"
                      className={inputCls + " pr-11"}
                      autoComplete="current-password"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <button type="button" onClick={() => navigate("/forgot-password")}
                    className="text-[11px] text-blue-600 font-semibold mt-1.5 block hover:text-blue-700">
                    Forgot password?
                  </button>
                </div>

                {loginErr && (
                  <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex gap-2 items-start">
                    <span className="text-sm mt-0.5">⚠️</span>
                    <p className="text-red-600 text-xs font-medium">{loginErr}</p>
                  </div>
                )}
              </div>
            )}

            {/* ════════ REGISTER ════════ */}
            {mode === "register" && (
              <>
                {/* Progress */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full transition-all duration-500"
                      style={{ width: step === 1 ? "50%" : "100%" }} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">
                    {step} of 2
                  </span>
                </div>

                {/* ── STEP 1 ── */}
                {step === 1 && (
                  <div className="space-y-3.5">
                    <div className="mb-3">
                      <h1 className="text-xl font-extrabold text-gray-900">Create your account</h1>
                      <p className="text-xs text-gray-500 mt-0.5">Join sphere today</p>
                    </div>

                    {/* Full name — full width */}
                    <div>
                      <label className={labelCls}>Full Name</label>
                      <input value={name} onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name" className={inputCls} autoComplete="name" />
                    </div>

                    {/* Username — own row */}
                    <div>
                      <label className={labelCls}>
                        Username <span className="normal-case font-normal text-gray-400">(max 14)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm select-none">@</span>
                        <input
                          value={username}
                          maxLength={14}
                          onChange={(e) => setUsername(e.target.value.replace(/^@/, "").replace(/[^a-zA-Z0-9_]/g, ""))}
                          placeholder="your_name"
                          className={inputCls + " pl-8"}
                          autoComplete="off"
                          autoCapitalize="none"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className={labelCls}>Email</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com" className={inputCls} autoComplete="email" />
                    </div>

                    {/* Password */}
                    <div>
                      <label className={labelCls}>
                        Password <span className="normal-case font-normal text-gray-400">(8–14 chars)</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showRegPass ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Letter + number + symbol"
                          className={inputCls + " pr-11"}
                          autoComplete="new-password"
                        />
                        <button type="button" onClick={() => setShowRegPass(!showRegPass)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                          {showRegPass ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* DOB — max enforces 14+ */}
                    <div>
                      <label className={labelCls}>
                        Date of Birth <span className="normal-case font-normal text-gray-400">(14+ only)</span>
                      </label>
                      <input type="date" value={dob} max={maxDob}
                        onChange={(e) => setDob(e.target.value)} className={inputCls} />
                    </div>

                    {/* Gender */}
                    <div>
                      <label className={labelCls}>Gender</label>
                      <GenderSelect value={gender} onChange={setGender} />
                    </div>

                    {regErr && (
                      <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex gap-2 items-start">
                        <span className="text-sm">⚠️</span>
                        <p className="text-red-600 text-xs font-medium">{regErr}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── STEP 2 ── */}
                {step === 2 && (
                  <div className="space-y-5">
                    <AnonInfoModal show={showAnonInfo} onClose={() => setShowAnonInfo(false)} />

                    {/* Header + ℹ button */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                          <Shield size={17} className="text-blue-600" />
                          Anonymous Identity
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">Your hidden posting persona</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAnonInfo(true)}
                        className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 hover:bg-blue-100 flex-shrink-0"
                      >
                        <Info size={14} />
                      </button>
                    </div>

                    {/* Anon username */}
                    <div>
                      <label className={labelCls}>Anonymous Username</label>
                      <input
                        value={anonUser}
                        onChange={(e) => setAnonUser(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                        placeholder="shadow_voice_77 (6–12 chars)"
                        className={inputCls}
                        autoComplete="off"
                        autoCapitalize="none"
                        maxLength={12}
                      />
                      <p className="text-[10px] text-gray-400 mt-1">⚠️ Permanent — cannot be changed</p>
                    </div>

                    {/* PIN 1 — auto-advances to confirm */}
                    <PinDots
                      label="Create 4-digit PIN"
                      value={pin}
                      onChange={setPin}
                      onComplete={() => confirmPinRef.current?.click()}
                    />

                    {/* PIN 2 confirm */}
                    <PinDots
                      label="Confirm PIN"
                      value={pinConfirm}
                      onChange={setPinConfirm}
                      inputRef={confirmPinRef}
                    />

                    {regErr && (
                      <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex gap-2 items-center justify-center">
                        <span>⚠️</span>
                        <p className="text-red-600 text-xs font-medium">{regErr}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════
            FIXED BOTTOM CTA BAR
        ══════════════════════════════════════════ */}
        <div className="flex-shrink-0 bg-white border-t border-gray-100 px-5 lg:px-8 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
          <div className="w-full max-w-xs mx-auto lg:max-w-sm lg:mx-0 flex flex-col gap-2">

            {mode === "login" && (
              <button onClick={() => handleLogin()} disabled={loginLoading} className={btnBlue}>
                {loginLoading ? <><Spinner />Logging in…</> : "Log In"}
              </button>
            )}

            {mode === "register" && step === 1 && (
              <button onClick={goStep2} className={btnBlue}>
                Continue <ArrowRight size={15} />
              </button>
            )}

            {mode === "register" && step === 2 && (
              <div className="flex gap-3">
                <button
                  onClick={() => { setStep(1); setRegErr(""); }}
                  className="flex items-center gap-1.5 px-5 py-3.5 border-2 border-gray-200 rounded-full text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all active:scale-[0.98]"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button onClick={() => handleRegister()} disabled={regLoading} className={btnBlue + " flex-1"}>
                  {regLoading ? <><Spinner />Creating…</> : "Create Account 🎉"}
                </button>
              </div>
            )}

            <p className="text-center text-[11px] text-gray-400">
              {mode === "login" ? (
                <>Don't have an account?{" "}
                  <button onClick={() => switchMode("register")} className="text-blue-600 font-bold">Register</button>
                </>
              ) : (
                <>Already have an account?{" "}
                  <button onClick={() => switchMode("login")} className="text-blue-600 font-bold">Log In</button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* slideUp keyframe for modal */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

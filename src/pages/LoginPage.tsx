import React, { useState } from "react";
import { useNavigate } from "react-router";
import {
  Eye, EyeOff, ArrowLeft, ArrowRight, CheckCircle2,
  User, Building2, Shield, ChevronDown,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

/* ── helpers ── */
type Mode = "login" | "register";
type AcctType = "personal" | "org";
type Step = 1 | 2;

function PinInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [shake, setShake] = useState(false);
  const digits = value.split("").concat(Array(4 - value.length).fill(""));

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key >= "0" && e.key <= "9" && value.length < 4) onChange(value + e.key);
    if (e.key === "Backspace") onChange(value.slice(0, -1));
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      <div className={`flex gap-4 ${shake ? "pin-shake" : ""}`} tabIndex={0} onKeyDown={handleKey}
        role="group" aria-label={label} style={{ outline: "none" }}>
        {digits.map((d, i) => (
          <div key={i} className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all ${
            d ? "bg-blue-600 border-blue-600" : "bg-gray-100 border-gray-300"
          }`}>
            {d && <div className="w-3 h-3 rounded-full bg-white" />}
          </div>
        ))}
      </div>
      {/* Invisible input captures keystrokes */}
      <input
        type="number" inputMode="numeric" pattern="[0-9]*"
        value={value} onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
          onChange(v);
        }}
        className="absolute opacity-0 pointer-events-none w-0 h-0"
        autoComplete="one-time-code"
      />
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [acctType, setAcctType] = useState<AcctType>("personal");
  const [step, setStep] = useState<Step>(1);

  /* login */
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  /* register step 1 */
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showRegPass, setShowRegPass] = useState(false);
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");

  /* org step 1 */
  const [orgName, setOrgName] = useState("");
  const [orgHandle, setOrgHandle] = useState("");
  const [orgCategory, setOrgCategory] = useState("");
  const [orgWebsite, setOrgWebsite] = useState("");
  const [orgCountry, setOrgCountry] = useState("India");
  const [orgPhone, setOrgPhone] = useState("");

  /* step 2 personal */
  const [anonUser, setAnonUser] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinErr, setPinErr] = useState("");

  /* org step 2 */
  const [orgDesc, setOrgDesc] = useState("");

  const [regErr, setRegErr] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  /* ── Login ── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPass) { setLoginErr("Please fill all fields"); return; }
    setLoginLoading(true); setLoginErr("");
    const { error } = await signIn(loginEmail, loginPass);
    setLoginLoading(false);
    if (error) setLoginErr(error.message);
    else navigate("/feed");
  };

  /* ── Step 1 validation ── */
  const validateStep1 = () => {
    if (acctType === "personal") {
      if (!name.trim()) return "Full name is required";
      if (!username.trim() || !/^[a-zA-Z0-9_]{3,10}$/.test(username)) return "Username: 3-10 chars, letters/digits/underscore";
      if (!email.includes("@")) return "Enter a valid email";
      if (password.length < 8 || password.length > 14) return "Password must be 8-14 characters";
      if (!dob) return "Date of birth is required";
      const age = (Date.now() - new Date(dob).getTime()) / (365.25 * 864e5);
      if (age < 14) return "You must be at least 14 years old";
    } else {
      if (!orgName.trim()) return "Organisation name required";
      if (!orgHandle.trim() || !/^[a-zA-Z0-9_]{3,15}$/.test(orgHandle)) return "Handle: 3-15 chars, letters/digits/underscore";
      if (!orgCategory) return "Select a category";
      if (!email.includes("@")) return "Enter a valid official email";
      if (password.length < 8) return "Password must be at least 8 characters";
    }
    return null;
  };

  /* ── Step 2 validation ── */
  const validateStep2 = () => {
    if (acctType === "personal") {
      if (!anonUser.trim() || !/^[a-zA-Z0-9_]{6,12}$/.test(anonUser)) return "Anon username: 6-12 chars";
      if (pin.length !== 4) return "PIN must be exactly 4 digits";
      if (pin !== pinConfirm) return "PINs do not match";
    }
    return null;
  };

  const goStep2 = () => {
    const err = validateStep1();
    if (err) { setRegErr(err); return; }
    setRegErr(""); setStep(2);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateStep2();
    if (err) { setRegErr(err); return; }
    setRegLoading(true); setRegErr("");
    const { error } = await signUp({
      email, password, name,
      username: username.replace(/^@/, ""),
      anon_username: anonUser,
      anon_pin: pin,
      gender, dob,
      is_org: acctType === "org",
      org_category: acctType === "org" ? orgCategory : undefined,
      org_description: acctType === "org" ? orgDesc : undefined,
    });
    setRegLoading(false);
    if (error) setRegErr(error.message);
    else navigate(acctType === "org" ? "/org/setup" : "/categories");
  };

  const ORG_CATS = ["News Media","Sports","Business","NGO","Government","Entertainment","Education","Other"];

  const inputCls = "w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all";
  const labelCls = "block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide";

  return (
    <div className="min-h-screen flex">
      {/* ── Left blue panel (desktop only) ── */}
      <div className="hidden lg:flex flex-col items-center justify-center w-1/2 bg-blue-600 text-white p-12 gap-8">
        <div className="text-center">
          <p className="font-sphere text-6xl mb-4">sphere</p>
          <p className="text-xl font-semibold mb-2">Your world. Your voice.</p>
          <p className="text-blue-200 text-sm">India's platform for real conversations — speak freely, connect deeply.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
          {[
            { icon:"🔥", label:"Trending Topics" },
            { icon:"🛡️", label:"Anonymous Mode" },
            { icon:"🏙️", label:"Local Feeds" },
            { icon:"🌐", label:"9 Languages" },
          ].map(({ icon, label }) => (
            <div key={label} className="bg-blue-500/50 rounded-xl p-3 flex items-center gap-2">
              <span className="text-xl">{icon}</span>
              <span className="text-sm font-semibold">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 bg-white overflow-y-auto">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center">
          <p className="font-sphere text-4xl text-blue-600 mb-1">sphere</p>
          <p className="text-sm text-gray-500">Your world. Your voice.</p>
        </div>

        <div className="w-full max-w-sm">
          {/* ── Mode tabs ── */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            {(["login","register"] as Mode[]).map((m) => (
              <button key={m} onClick={() => { setMode(m); setStep(1); setRegErr(""); setLoginErr(""); }}
                className={`flex-1 py-2 rounded-lg text-sm font-bold capitalize transition-all ${mode === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                {m === "login" ? "Log In" : "Register"}
              </button>
            ))}
          </div>

          {/* ── Account type toggle (register only) ── */}
          {mode === "register" && (
            <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
              {(["personal","org"] as AcctType[]).map((t) => (
                <button key={t} onClick={() => { setAcctType(t); setStep(1); setRegErr(""); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                    acctType === t
                      ? t === "personal" ? "bg-blue-600 text-white shadow-sm" : "bg-gray-900 text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}>
                  {t === "personal" ? <User size={14} /> : <Building2 size={14} />}
                  {t === "personal" ? "Personal Account" : "Organisation Account"}
                </button>
              ))}
            </div>
          )}

          {/* ── Step indicator (register only) ── */}
          {mode === "register" && (
            <div className="flex items-center gap-2 mb-5">
              {[1,2].map((s) => (
                <React.Fragment key={s}>
                  <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-all ${
                    step >= s ? (acctType === "org" ? "bg-gray-900 text-white" : "bg-blue-600 text-white") : "bg-gray-200 text-gray-500"
                  }`}>{s >= step ? s : <CheckCircle2 size={14} />}</div>
                  {s < 2 && <div className={`flex-1 h-0.5 rounded ${step > s ? (acctType === "org" ? "bg-gray-900" : "bg-blue-600") : "bg-gray-200"}`} />}
                </React.Fragment>
              ))}
              <span className="text-xs text-gray-500 ml-1">Step {step} of 2</span>
            </div>
          )}

          {/* ════════════════════════════════════ */}
          {/* ── LOGIN FORM ── */}
          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className={labelCls}>Email or Username</label>
                <input type="text" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="email@example.com or @username" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <div className="relative">
                  <input type={showPass ? "text" : "password"} value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    placeholder="Your password" className={inputCls + " pr-10"} />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {loginErr && <p className="text-red-500 text-xs font-medium">{loginErr}</p>}
              <button type="button" onClick={() => navigate("/forgot-password")}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold">
                Forgot password?
              </button>
              <button type="submit" disabled={loginLoading}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-60 transition-all">
                {loginLoading ? "Logging in…" : "Log In"}
              </button>
            </form>
          )}

          {/* ════════════════════════════════════ */}
          {/* ── REGISTER — STEP 1 PERSONAL ── */}
          {mode === "register" && step === 1 && acctType === "personal" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Full Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Arjun Mehta" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Username</label>
                  <input value={username} onChange={(e) => setUsername(e.target.value.replace(/^@/,""))}
                    placeholder="arjun_m" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <div className="relative">
                  <input type={showRegPass ? "text" : "password"} value={password}
                    onChange={(e) => setPassword(e.target.value)} placeholder="8-14 chars, letter+digit+symbol"
                    className={inputCls + " pr-10"} />
                  <button type="button" onClick={() => setShowRegPass(!showRegPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showRegPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Date of Birth</label>
                  <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Gender</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputCls}>
                    <option value="">Select</option>
                    <option>Male</option><option>Female</option>
                    <option>Other</option><option>Prefer not to say</option>
                  </select>
                </div>
              </div>
              {regErr && <p className="text-red-500 text-xs font-medium">{regErr}</p>}
              <button onClick={goStep2}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                Continue <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* ── REGISTER — STEP 1 ORG ── */}
          {mode === "register" && step === 1 && acctType === "org" && (
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Organisation Name</label>
                <input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Times of India" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Handle</label>
                  <input value={orgHandle} onChange={(e) => setOrgHandle(e.target.value.replace(/^@/,""))}
                    placeholder="timesofindia" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Category</label>
                  <select value={orgCategory} onChange={(e) => setOrgCategory(e.target.value)} className={inputCls}>
                    <option value="">Select</option>
                    {ORG_CATS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Official Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@organisation.com" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <div className="relative">
                  <input type={showRegPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 characters" className={inputCls + " pr-10"} />
                  <button type="button" onClick={() => setShowRegPass(!showRegPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showRegPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Website (optional)</label>
                  <input value={orgWebsite} onChange={(e) => setOrgWebsite(e.target.value)} placeholder="https://" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Country</label>
                  <input value={orgCountry} onChange={(e) => setOrgCountry(e.target.value)} className={inputCls} />
                </div>
              </div>
              {regErr && <p className="text-red-500 text-xs font-medium">{regErr}</p>}
              <button onClick={goStep2}
                className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-all flex items-center justify-center gap-2">
                Continue <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* ── REGISTER — STEP 2 PERSONAL ── */}
          {mode === "register" && step === 2 && acctType === "personal" && (
            <form onSubmit={handleRegister} className="space-y-5">
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
                <p className="font-bold flex items-center gap-1 mb-1"><Shield size={13} />Set up your anonymous identity</p>
                <p className="text-blue-600">This lets you post anonymously. Choose a username that reveals nothing about you. Your PIN is permanent protection — store it safely.</p>
              </div>
              <div>
                <label className={labelCls}>Anonymous Username</label>
                <input value={anonUser} onChange={(e) => setAnonUser(e.target.value)}
                  placeholder="shadow_voice_77 (6-12 chars)" className={inputCls} />
                <p className="text-xs text-gray-400 mt-1">⚠️ Permanent — cannot be changed later</p>
              </div>
              <div className="space-y-4 mt-2">
                {/* Visual PIN inputs */}
                <PinDots label="Create 4-digit Anon PIN" value={pin} onChange={setPin} />
                <PinDots label="Confirm PIN" value={pinConfirm} onChange={setPinConfirm} />
              </div>
              {regErr && <p className="text-red-500 text-xs font-medium text-center">{regErr}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => { setStep(1); setRegErr(""); }}
                  className="flex items-center gap-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">
                  <ArrowLeft size={15} /> Back
                </button>
                <button type="submit" disabled={regLoading}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-60 transition-all">
                  {regLoading ? "Creating account…" : "Create Account 🎉"}
                </button>
              </div>
            </form>
          )}

          {/* ── REGISTER — STEP 2 ORG ── */}
          {mode === "register" && step === 2 && acctType === "org" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className={labelCls}>About Your Organisation</label>
                <textarea value={orgDesc} onChange={(e) => setOrgDesc(e.target.value.slice(0,200))}
                  placeholder="Tell people what your organisation is about…"
                  rows={4} className={inputCls + " resize-none"} />
                <p className="text-xs text-gray-400 mt-1 text-right">{orgDesc.length}/200</p>
              </div>
              {regErr && <p className="text-red-500 text-xs font-medium">{regErr}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => { setStep(1); setRegErr(""); }}
                  className="flex items-center gap-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">
                  <ArrowLeft size={15} /> Back
                </button>
                <button type="submit" disabled={regLoading}
                  className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 disabled:opacity-60 transition-all">
                  {regLoading ? "Creating…" : "Create Organisation 🏢"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* Inner PIN dots component */
function PinDots({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center gap-3" onClick={() => ref.current?.focus()}>
      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">{label}</p>
      <div className="flex gap-4">
        {[0,1,2,3].map((i) => (
          <div key={i} className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${
            value[i] ? "bg-blue-600 border-blue-600" : "bg-gray-100 border-gray-300"
          }`}>
            {value[i] && <div className="w-3 h-3 rounded-full bg-white" />}
          </div>
        ))}
      </div>
      <input
        ref={ref}
        type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={4}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g,"").slice(0,4))}
        className="w-1 h-1 opacity-0 absolute"
      />
    </div>
  );
}

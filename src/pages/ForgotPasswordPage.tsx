import React, { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Mail, Check, User, AlertCircle, KeyRound } from "lucide-react";
import { supabase } from "../lib/supabase";

type Tab = "password" | "username";

function Spinner() {
  return <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
  </svg>;
}

/* ════════════════════════════════════════════════════════════
   NAME MATCHING — case-sensitive, full-word match
   At least ONE complete word from the input must exactly match
   at least ONE complete word from the stored name.

   Examples (stored "Rahul Sharma"):
     "Rahul"        → ✅ (word "Rahul" matches)
     "Sharma"       → ✅ (word "Sharma" matches)
     "rahul"        → ❌ (case mismatch)
     "Rahul Sharma" → ✅
     "Ra"           → ❌ (not a full word)
     "Rah"          → ❌ (not a full word)
════════════════════════════════════════════════════════════ */
function namesWordMatch(stored: string, input: string): boolean {
  const storedWords = stored.trim().split(/\s+/).filter(w => w.length >= 2);
  const inputWords  = input.trim().split(/\s+/).filter(w => w.length >= 2);
  // At least one input word must exactly match (case-sensitive) a stored word
  return inputWords.some(iw => storedWords.some(sw => sw === iw));
}

/* ════════════════════════════════════════════════════════════
   FORGOT PASSWORD FLOW
════════════════════════════════════════════════════════════ */
function ForgotPasswordFlow() {
  type PwStep = "email" | "verify" | "done";
  const [step,            setStep]           = useState<PwStep>("email");
  const [email,           setEmail]          = useState("");
  const [loading,         setLoading]        = useState(false);
  const [error,           setError]          = useState("");
  const [byUsername,      setByUsername]     = useState(false);
  const [usernameInput,   setUsernameInput]  = useState("");
  const [usernameLoading, setUsernameLoading]= useState(false);

  /* Verification form (multi-account case) */
  const [verifyUsername,  setVerifyUsername] = useState("");
  const [verifyName,      setVerifyName]     = useState("");
  const [verifyLoading,   setVerifyLoading]  = useState(false);

  /* ── Step 1: check email ── */
  const handleEmailSubmit = async () => {
    setError("");
    // Email — keep lowercase (emails always stored lowercase)
    const e = email.trim().toLowerCase();
    if (!e.includes("@")) { setError("Please enter a valid email address"); return; }
    setLoading(true);

    const { data: accounts } = await supabase
      .from("profiles").select("id").eq("email", e);

    if (!accounts || accounts.length === 0) {
      setLoading(false);
      setError("No account found with this email address.");
      return;
    }

    if (accounts.length === 1) {
      await supabase.auth.resetPasswordForEmail(e, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setLoading(false);
      setStep("done");
    } else {
      setLoading(false);
      setStep("verify");
    }
  };

  /* ── By username — case-sensitive: user must type username exactly ── */
  const handleUsernameReset = async () => {
    setError("");
    const u = usernameInput.trim().replace(/^@/, "");
    if (!u) { setError("Please enter your username"); return; }
    setUsernameLoading(true);

    const { data: profile } = await supabase
      .from("profiles").select("email").eq("username", u).maybeSingle();

    setUsernameLoading(false);

    if (!profile?.email) { setError("No account found with this username."); return; }

    await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setStep("done");
  };

  /* ── Verify identity (multi-account case) ── */
  const handleVerify = async () => {
    setError("");
    if (!verifyUsername.trim() || !verifyName.trim()) {
      setError("Username and Full Name are both required.");
      return;
    }
    setVerifyLoading(true);

    // Username — case-sensitive: do NOT normalize case
    const u = verifyUsername.trim().replace(/^@/, "");
    // Name — NO lowercasing (case-sensitive match)
    const n = verifyName.trim();

    // Match on email + username (username uniquely identifies among shared emails)
    const { data: matches } = await supabase
      .from("profiles")
      .select("id, email, name")
      .eq("email", email.trim().toLowerCase())
      .eq("username", u);

    if (!matches || matches.length === 0) {
      setVerifyLoading(false);
      setError("Account not found. The username or name you entered did not match.");
      return;
    }

    const profile = matches[0];

    // Case-sensitive full-word name verification
    if (!namesWordMatch(profile.name ?? "", n)) {
      setVerifyLoading(false);
      setError("Account not found. The name must match exactly including capital letters.");
      return;
    }

    await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setVerifyLoading(false);
    setStep("done");
  };

  /* ── Done ── */
  if (step === "done") {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-8">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
          <Check size={32} className="text-green-500"/>
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-1">Reset link sent!</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Check your email inbox for the password reset link.<br/>
            It may take a minute or two to arrive.
          </p>
        </div>
      </div>
    );
  }

  /* ── Email step ── */
  if (step === "email") {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Forgot Password?</h2>
          <p className="text-sm text-gray-500 mt-1">Enter your email or username to reset your password.</p>
        </div>

        <div className="flex bg-gray-100 rounded-full p-1">
          <button onClick={() => { setByUsername(false); setError(""); }}
            className={`flex-1 py-2 rounded-full text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${!byUsername ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
            <Mail size={13}/> By Email
          </button>
          <button onClick={() => { setByUsername(true); setError(""); }}
            className={`flex-1 py-2 rounded-full text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${byUsername ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
            <User size={13}/> By Username
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex gap-2 items-start">
            <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5"/>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {!byUsername ? (
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Email Address</label>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleEmailSubmit()}
                placeholder="your@email.com"
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-full text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"/>
            </div>
            <button onClick={handleEmailSubmit} disabled={loading || !email.includes("@")}
              className="w-full py-3.5 bg-blue-600 text-white rounded-full font-bold text-[15px] hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-200/50">
              {loading ? <><Spinner/>Checking…</> : "Send Reset Link"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-2xl p-3 text-xs text-blue-700 leading-relaxed">
              Enter your username and we'll send a reset link to the email on your account.
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Username</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm pointer-events-none">@</span>
                <input type="text" value={usernameInput}
                  onChange={e => { setUsernameInput(e.target.value.replace(/^@/, "").replace(/[^a-zA-Z0-9_]/g, "")); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleUsernameReset()}
                  placeholder="your_username"
                  className="w-full pl-8 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-full text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                  autoCapitalize="none" autoComplete="off"/>
              </div>
            </div>
            <button onClick={handleUsernameReset} disabled={usernameLoading || !usernameInput.trim()}
              className="w-full py-3.5 bg-blue-600 text-white rounded-full font-bold text-[15px] hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-200/50">
              {usernameLoading ? <><Spinner/>Sending…</> : "Send Reset Link"}
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ── Verify step (multi-account) ── */
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900">Verify Your Identity</h2>
        <p className="text-sm text-gray-500 mt-1">
          Multiple accounts are linked to <strong>{email}</strong>. Enter your details to identify your account.
        </p>
      </div>
      <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 text-xs text-amber-700 leading-relaxed">
        ⚠️ Name must match exactly — including capital and small letters.
      </div>
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex gap-2 items-start">
          <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5"/>
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}
      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Username <span className="text-red-500">*</span></label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm pointer-events-none">@</span>
            <input type="text" value={verifyUsername}
              onChange={e => setVerifyUsername(e.target.value.replace(/^@/, "").replace(/[^a-zA-Z0-9_]/g, ""))}
              placeholder="your_username"
              className="w-full pl-8 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-full text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
              autoCapitalize="none" autoComplete="off"/>
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
            Full Name <span className="text-red-500">*</span>
            <span className="ml-1 text-[9px] font-normal normal-case text-amber-600">(case-sensitive)</span>
          </label>
          <input type="text" value={verifyName} onChange={e => setVerifyName(e.target.value)}
            placeholder="e.g. Rahul Sharma"
            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-full text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
            autoComplete="name"/>
        </div>
        <button onClick={handleVerify} disabled={verifyLoading || !verifyUsername.trim() || !verifyName.trim()}
          className="w-full py-3.5 bg-blue-600 text-white rounded-full font-bold text-[15px] hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-200/50">
          {verifyLoading ? <><Spinner/>Verifying…</> : "Verify & Send Reset Link"}
        </button>
        <button onClick={() => { setStep("email"); setError(""); }}
          className="w-full py-2.5 text-sm text-gray-500 font-medium hover:text-gray-700 transition-colors">
          ← Try a different email
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   FORGOT USERNAME FLOW
   — case-INSENSITIVE full-word name matching
════════════════════════════════════════════════════════════ */
function ForgotUsernameFlow() {
  const [email,    setEmail]    = useState("");
  const [fullName, setFullName] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [results,  setResults]  = useState<string[] | null>(null);

  const handleFind = async () => {
    setError(""); setResults(null);
    // Both email and name — normalize to lowercase (case-insensitive for username lookup)
    const e = email.trim().toLowerCase();
    const n = fullName.trim().toLowerCase();

    if (!e.includes("@")) { setError("Please enter a valid email address"); return; }
    if (!n)               { setError("Please enter your full name"); return; }
    setLoading(true);

    const { data: profiles } = await supabase
      .from("profiles").select("username, name").eq("email", e);

    setLoading(false);

    if (!profiles || profiles.length === 0) {
      setError("No account found with this email address."); return;
    }

    // Case-INSENSITIVE full-word match — lowercase both sides before comparing
    const matched = profiles.filter(p => namesWordMatch(
      (p.name ?? "").toLowerCase(), n
    ));

    if (matched.length === 0) {
      setError(
        "No account found. The name you entered did not match this email. " +
        "Try entering just your first name or just your last name."
      );
      return;
    }

    setResults(matched.map(p => p.username));
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900">Forgot Username?</h2>
        <p className="text-sm text-gray-500 mt-1">Enter your email and full name to find your username.</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 text-xs text-blue-700 leading-relaxed">
        💡 You can enter just your first name or last name — spelling doesn't need to be exact on capitals.
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex gap-2 items-start">
          <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5"/>
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-green-800 mb-2 flex items-center gap-1.5">
            <Check size={15}/> Account{results.length > 1 ? "s" : ""} found
          </p>
          {results.map(u => (
            <div key={u} className="flex items-center gap-2 py-1.5">
              <User size={14} className="text-gray-400"/>
              <span className="text-[15px] font-bold text-gray-900">@{u}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Email Address</label>
          <input type="email" value={email}
            onChange={e => { setEmail(e.target.value); setError(""); setResults(null); }}
            placeholder="your@email.com"
            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-full text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"/>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Full Name</label>
          <input type="text" value={fullName}
            onChange={e => { setFullName(e.target.value); setError(""); setResults(null); }}
            placeholder="e.g. Rahul Sharma"
            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-full text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
            autoComplete="name"/>
          <p className="text-xs text-gray-400 mt-1.5">
            You can enter just your first or last name.
          </p>
        </div>
        <button onClick={handleFind} disabled={loading || !email.includes("@") || !fullName.trim()}
          className="w-full py-3.5 bg-blue-600 text-white rounded-full font-bold text-[15px] hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-200/50">
          {loading ? <><Spinner/>Searching…</> : "Find My Username"}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════ */
export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("password");

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} className="text-gray-700"/>
        </button>
        <h1 className="font-bold text-gray-900 text-[15px]">Account Recovery</h1>
      </div>

      <div className="flex-1 flex flex-col items-center px-5 py-6 max-w-sm mx-auto w-full gap-6">
        <div className="w-full text-center pt-1">
          <h2 className="text-2xl font-extrabold text-gray-900">Account Recovery</h2>
          <p className="text-sm text-gray-500 mt-1">Recover your password or find your username</p>
        </div>

        <div className="flex bg-gray-100 rounded-full p-1 w-full">
          <button onClick={() => setActiveTab("password")}
            className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab==="password"?"bg-white text-gray-900 shadow-sm":"text-gray-500"}`}>
            <KeyRound size={13}/> Forgot Password
          </button>
          <button onClick={() => setActiveTab("username")}
            className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab==="username"?"bg-white text-gray-900 shadow-sm":"text-gray-500"}`}>
            <User size={13}/> Forgot Username
          </button>
        </div>

        <div className="w-full">
          {activeTab==="password" ? <ForgotPasswordFlow/> : <ForgotUsernameFlow/>}
        </div>

        <button onClick={() => navigate("/login")}
          className="text-sm text-blue-600 font-semibold hover:text-blue-700 transition-colors">
          Back to Login
        </button>
      </div>
    </div>
  );
}

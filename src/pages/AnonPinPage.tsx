import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  ArrowLeft, Shield, Check, Lock, AlertCircle, Upload, X, Loader2,
} from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../contexts/AuthContext";
import { supabase, setAnonPin, verifyAnonPin } from "../lib/supabase";

/* ══════════════════════════════════════════════════════════════
   AnonPinPage  —  /settings/anon-pin
   ?mode=create   first-time PIN setup
   ?mode=change   change existing PIN
   ?from=X        on success navigate to /X

   PIN is set/verified via Postgres RPC (set_anon_pin / verify_anon_pin)
   which use bcrypt from pgcrypto. No edge functions needed.

   CREATE FLOW  (anon_pin_set = false):
     1. Pick avatar (optional)
     2. Enter new PIN
     3. Confirm PIN  → calls set_anon_pin(newPin)

   CHANGE FLOW  (anon_pin_set = true):
     1. Verify current PIN  → calls verify_anon_pin(current)
     2. Pick avatar (optional)
     3. Enter new PIN
     4. Confirm PIN  → calls set_anon_pin(newPin, current)
══════════════════════════════════════════════════════════════ */

/* ─── Preset avatars ─── */
const PRESETS = [
  { id: "ghost",  emoji: "👻", bg: "#6366f1" },
  { id: "ninja",  emoji: "🥷", bg: "#0f172a" },
  { id: "robot",  emoji: "🤖", bg: "#0891b2" },
  { id: "alien",  emoji: "👽", bg: "#16a34a" },
  { id: "panda",  emoji: "🐼", bg: "#374151" },
  { id: "fox",    emoji: "🦊", bg: "#ea580c" },
  { id: "cat",    emoji: "🐱", bg: "#7c3aed" },
  { id: "wolf",   emoji: "🐺", bg: "#1e40af" },
];

interface AnonAvatar {
  type:       "preset" | "upload";
  presetId?:  string;
  uploadUrl?: string;
  uploadFile?: File;
}

/* ─── Avatar picker ─── */
function AvatarPicker({ value, onChange, anonUsername }: {
  value: AnonAvatar | null;
  onChange: (a: AnonAvatar | null) => void;
  anonUsername: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const preset  = value?.type === "preset" ? PRESETS.find(p => p.id === value.presetId) : null;

  return (
    <div className="w-full">
      {/* Preview */}
      <div className="flex flex-col items-center gap-2 mb-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-gray-100 dark:ring-gray-800">
            {value?.type === "upload" && value.uploadUrl ? (
              <img src={value.uploadUrl} alt="anon" className="w-full h-full object-cover" />
            ) : preset ? (
              <div className="w-full h-full flex items-center justify-center text-4xl" style={{ background: preset.bg }}>
                {preset.emoji}
              </div>
            ) : (
              <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                <Shield size={32} className="text-gray-400" />
              </div>
            )}
          </div>
          {value && (
            <button onClick={() => onChange(null)}
              className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-md">
              <X size={12} className="text-white" />
            </button>
          )}
        </div>
        <div className="text-center">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">@{anonUsername}</p>
          <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-0.5">Your anonymous identity</p>
        </div>
      </div>

      {/* Presets */}
      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 text-center">
        Choose an avatar
      </p>
      <div className="grid grid-cols-4 gap-2.5 mb-3">
        {PRESETS.map(p => (
          <button key={p.id} onClick={() => onChange({ type: "preset", presetId: p.id })}
            className={`h-14 rounded-2xl flex items-center justify-center text-2xl transition-all active:scale-95 ${
              value?.type === "preset" && value.presetId === p.id
                ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-950 scale-105"
                : "hover:scale-105"
            }`}
            style={{ background: p.bg }}>
            {p.emoji}
          </button>
        ))}
      </div>

      {/* Upload */}
      <button onClick={() => fileRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-all">
        <Upload size={15} /> Upload from device
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => {
        const f = e.target.files?.[0];
        if (!f || !f.type.startsWith("image/")) return;
        if (f.size > 5 * 1024 * 1024) { alert("Image must be under 5MB"); return; }
        onChange({ type: "upload", uploadUrl: URL.createObjectURL(f), uploadFile: f });
      }} />
      <p className="text-[11px] text-gray-400 text-center mt-1.5">Optional · JPG, PNG, WebP · max 5 MB</p>
    </div>
  );
}

/* ─── PIN input — real keyboard, dot display ─── */
function PinInput({ label, value, onChange, matchStatus, autoFocus = false }: {
  label:       string;
  value:       string;
  onChange:    (v: string) => void;
  matchStatus?: boolean | null;
  autoFocus?:  boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  return (
    <div className="w-full" onClick={() => inputRef.current?.focus()}>
      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4 text-center">
        {label}
      </p>
      {/* Dot boxes */}
      <div className="flex gap-3 justify-center mb-3">
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center transition-all cursor-text select-none ${
            value.length > i
              ? "bg-gray-900 dark:bg-white border-gray-900 dark:border-white"
              : value.length === i
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
              : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
          }`}>
            {value.length > i && <div className="w-3 h-3 rounded-full bg-white dark:bg-gray-900" />}
          </div>
        ))}
      </div>
      {/* Real input — opens numeric keyboard */}
      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        className="sr-only"
        autoComplete="off"
      />
      {/* Live match feedback */}
      {matchStatus !== null && matchStatus !== undefined && value.length === 4 && (
        <div className={`flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
          matchStatus ? "text-green-500" : "text-red-500"
        }`}>
          {matchStatus
            ? <><Check size={13} /> PINs match</>
            : <><AlertCircle size={13} /> PINs don't match</>}
        </div>
      )}
    </div>
  );
}

/* ─── Step indicator ─── */
function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
            current > i + 1 ? "bg-green-500 text-white"
              : current === i + 1 ? "bg-blue-600 text-white"
              : "bg-gray-100 dark:bg-gray-800 text-gray-400"
          }`}>
            {current > i + 1 ? <Check size={12} /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`flex-1 h-0.5 max-w-[40px] rounded transition-all ${
              current > i + 1 ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export function AnonPinPage() {
  const navigate     = useNavigate();
  const [params]     = useSearchParams();
  const { user, profile, refreshProfile } = useAuth();

  const from     = params.get("from");
  const isCreate = params.get("mode") === "create" || !profile?.anon_pin_set;
  const totalSteps = isCreate ? 3 : 4;

  /* State */
  const [step,     setStep]    = useState(1);
  const [avatar,   setAvatar]  = useState<AnonAvatar | null>(null);
  const [current,  setCurrent] = useState("");   // existing PIN for change flow
  const [newPin,   setNewPin]  = useState("");
  const [confirm,  setConfirm] = useState("");
  const [error,    setError]   = useState("");
  const [loading,  setLoading] = useState(false);
  const [locked,   setLocked]  = useState(false);
  const [lockSecs, setLockSecs]= useState(0);
  const [done,     setDone]    = useState(false);

  /* Countdown timer */
  useEffect(() => {
    if (!locked) return;
    const iv = setInterval(() => {
      setLockSecs(s => { if (s <= 1) { setLocked(false); clearInterval(iv); return 0; } return s - 1; });
    }, 1000);
    return () => clearInterval(iv);
  }, [locked]);

  const matchStatus: boolean | null = confirm.length === 4 ? newPin === confirm : null;

  /* Upload avatar */
  const saveAvatar = async () => {
    if (!avatar || !user?.id) return;
    try {
      let url: string | null = null;
      if (avatar.type === "preset") {
        url = `preset:${avatar.presetId}`;
      } else if (avatar.uploadFile) {
        const ext  = avatar.uploadFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/anon_avatar.${ext}`;
        const { error: upErr } = await supabase.storage.from("avatars")
          .upload(path, avatar.uploadFile, { upsert: true });
        if (upErr) throw upErr;
        url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
      if (url) {
        await supabase.from("profiles")
          .update({ anon_avatar_url: url, updated_at: new Date().toISOString() })
          .eq("id", user.id);
      }
    } catch (e) {
      console.error("Avatar save failed:", e);
    }
  };

  const goBack = () => {
    if (from) navigate(`/${from}`, { replace: true });
    else navigate(-1);
  };

  /*
    advance() uses useCallback with explicit deps so it always has
    fresh state — this fixes the stale closure bug that caused
    auto-advance to call advance() with the wrong step value.
  */
  const advance = useCallback(async () => {
    setError("");
    setLoading(true);

    try {
      if (isCreate) {
        /* CREATE: step 1=avatar, 2=new pin, 3=confirm */
        if (step === 1) {
          setStep(2);
          setLoading(false);
          return;
        }
        if (step === 2) {
          if (newPin.length !== 4) { setError("Enter 4 digits"); setLoading(false); return; }
          setStep(3);
          setLoading(false);
          return;
        }
        if (step === 3) {
          if (newPin !== confirm) { setError("PINs don't match"); setConfirm(""); setLoading(false); return; }
          await setAnonPin(newPin);
          await saveAvatar();
          await refreshProfile();
          setDone(true);
          setTimeout(goBack, 1200);
          return;
        }
      } else {
        /* CHANGE: step 1=verify, 2=avatar, 3=new pin, 4=confirm */
        if (step === 1) {
          if (current.length !== 4) { setError("Enter your 4-digit PIN"); setLoading(false); return; }
          const result = await verifyAnonPin(current);
          if (!result.success) {
            if (result.locked) { setLocked(true); setLockSecs(1800); setError("Too many attempts. Locked 30 min."); }
            else { setError(`Incorrect PIN — ${result.attempts_left} attempt${result.attempts_left === 1 ? "" : "s"} left`); setCurrent(""); }
            setLoading(false);
            return;
          }
          setStep(2);
          setLoading(false);
          return;
        }
        if (step === 2) {
          setStep(3);
          setLoading(false);
          return;
        }
        if (step === 3) {
          if (newPin.length !== 4) { setError("Enter 4 digits"); setLoading(false); return; }
          setStep(4);
          setLoading(false);
          return;
        }
        if (step === 4) {
          if (newPin !== confirm) { setError("PINs don't match"); setConfirm(""); setLoading(false); return; }
          await setAnonPin(newPin, current);
          await saveAvatar();
          await refreshProfile();
          setDone(true);
          setTimeout(goBack, 1200);
          return;
        }
      }
    } catch (e: any) {
      console.error("advance error:", e);
      setError(e?.message || "Something went wrong. Please try again.");
    }

    setLoading(false);
  }, [step, isCreate, current, newPin, confirm, avatar, user?.id]);

  /* Step numbers */
  const avatarStep = isCreate ? 1 : 2;
  const pinStep    = isCreate ? 2 : 3;
  const confStep   = isCreate ? 3 : 4;

  /*
    Auto-advance when PIN rows fill to 4 digits.
    Each effect has the correct dependencies so advance() is fresh.
  */
  useEffect(() => {
    if (!isCreate && step === 1 && current.length === 4 && !loading) {
      const t = setTimeout(() => advance(), 350);
      return () => clearTimeout(t);
    }
  }, [current, step, isCreate, loading, advance]);

  useEffect(() => {
    if (step === pinStep && newPin.length === 4 && !loading) {
      const t = setTimeout(() => advance(), 350);
      return () => clearTimeout(t);
    }
  }, [newPin, step, pinStep, loading, advance]);

  useEffect(() => {
    if (step === confStep && confirm.length === 4 && newPin === confirm && !loading) {
      const t = setTimeout(() => advance(), 500);
      return () => clearTimeout(t);
    }
  }, [confirm, step, confStep, newPin, loading, advance]);

  const anonUsername = profile?.anon_username || "anonymous";

  return (
    <AppShell>
      <div className="min-h-full bg-white dark:bg-gray-950">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="font-bold text-gray-900 dark:text-white text-base flex-1">
            {isCreate ? "Set Up Anonymous Profile" : "Update Anonymous Profile"}
          </h1>
        </div>

        <div className="max-w-sm mx-auto px-6 py-8 flex flex-col items-center gap-7">

          {done ? (
            /* ── Success ── */
            <>
              <div className="w-16 h-16 rounded-2xl bg-green-500 flex items-center justify-center">
                <Check size={32} className="text-white" />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-900 dark:text-white text-xl mb-1">
                  {isCreate ? "Anonymous profile ready!" : "Updated!"}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  You can now post anonymously on Sphere.
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Shield icon */}
              <div className="w-14 h-14 rounded-2xl bg-gray-900 dark:bg-gray-800 flex items-center justify-center">
                <Shield size={26} className="text-gray-200" />
              </div>

              <StepBar current={step} total={totalSteps} />

              {/* Locked warning */}
              {locked && (
                <div className="w-full flex items-center gap-2 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-xl px-4 py-3 text-sm text-orange-600 dark:text-orange-400">
                  <Lock size={14} className="shrink-0" />
                  <span>Too many attempts — try again in <strong>{lockSecs}s</strong></span>
                </div>
              )}

              {/* ── STEP: Avatar ── */}
              {step === avatarStep && (
                <>
                  <div className="text-center">
                    <p className="font-bold text-gray-900 dark:text-white text-lg">Choose your anon avatar</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Optional — skip to continue</p>
                  </div>
                  <AvatarPicker value={avatar} onChange={setAvatar} anonUsername={anonUsername} />
                  <button onClick={advance} disabled={loading}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-60">
                    {avatar ? "Save & Continue →" : "Skip & Continue →"}
                  </button>
                </>
              )}

              {/* ── STEP: Verify current PIN (change flow, step 1) ── */}
              {!isCreate && step === 1 && !locked && (
                <>
                  <div className="text-center">
                    <p className="font-bold text-gray-900 dark:text-white text-lg">Verify your current PIN</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Enter your existing 4-digit PIN to continue</p>
                  </div>
                  <PinInput label="Current PIN" value={current} onChange={setCurrent} autoFocus={true} />
                  {loading && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 size={14} className="animate-spin" /> Verifying…
                    </div>
                  )}
                  {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}
                </>
              )}

              {/* ── STEP: Enter new PIN ── */}
              {step === pinStep && (
                <>
                  <div className="text-center">
                    <p className="font-bold text-gray-900 dark:text-white text-lg">Set your PIN</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Choose a 4-digit PIN to post anonymously</p>
                  </div>
                  <PinInput label="New PIN" value={newPin} onChange={setNewPin} autoFocus={true} />
                  {loading && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 size={14} className="animate-spin" /> Moving on…
                    </div>
                  )}
                  {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}
                </>
              )}

              {/* ── STEP: Confirm PIN ── */}
              {step === confStep && (
                <>
                  <div className="text-center">
                    <p className="font-bold text-gray-900 dark:text-white text-lg">Confirm your PIN</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Re-enter to confirm</p>
                  </div>
                  <PinInput
                    label="Confirm PIN"
                    value={confirm}
                    onChange={setConfirm}
                    matchStatus={matchStatus}
                    autoFocus={true}
                  />
                  {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}
                  {loading && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 size={14} className="animate-spin" /> Setting PIN…
                    </div>
                  )}
                  {/* Create PIN button — only enabled when match */}
                  <button
                    onClick={advance}
                    disabled={matchStatus !== true || loading}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                      matchStatus === true && !loading
                        ? "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    {loading
                      ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                      : <><Check size={14} /> {isCreate ? "Create PIN" : "Save New PIN"}</>}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

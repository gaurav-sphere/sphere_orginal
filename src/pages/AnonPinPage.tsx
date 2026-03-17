import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Shield, Check, Lock, Eye, EyeOff, AlertCircle, Image as ImageIcon } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../contexts/AuthContext";
import { supabase, setAnonPin, verifyAnonPin } from "../lib/supabase";

/* ══════════════════════════════════════════════════════════════
   AnonPinPage
   Route: /settings/anon-pin

   URL params:
   ?mode=create  — first-time PIN setup (from create-post flow or settings)
   ?mode=change  — change existing PIN (default)
   ?from=create-post — after success, return to /create-post

   CREATE FLOW (mode=create, anon_pin_set = false):
     Step 1: Enter new PIN
     Step 2: Confirm PIN
     → calls setAnonPin(pin)

   CHANGE FLOW (mode=change, anon_pin_set = true):
     Step 1: Enter current PIN (calls verifyAnonPin to validate)
     Step 2: Enter new PIN
     Step 3: Confirm new PIN
     → calls setAnonPin(newPin, currentPin)

   NOTE: Anon avatar is shown as "coming soon" since the DB
   does not yet have an anon_avatar_url column in profiles.
   To add it: ALTER TABLE profiles ADD COLUMN anon_avatar_url text;
══════════════════════════════════════════════════════════════ */

/* ── PIN dots input ── */
function PinDots({
  label, value, onChange, error, autoFocus = false,
}: {
  label:     string;
  value:     string;
  onChange:  (v: string) => void;
  error?:    string;
  autoFocus?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 100);
  }, [autoFocus]);

  return (
    <div className="flex flex-col items-center gap-4" onClick={() => inputRef.current?.focus()}>
      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{label}</p>

      <div className="flex gap-4">
        {[0,1,2,3].map(i => (
          <div key={i}
            className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center transition-all cursor-pointer select-none ${
              value[i]
                ? "bg-gray-900 dark:bg-gray-100 border-gray-900 dark:border-gray-100"
                : value.length === i
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            }`}>
            {value[i] && (
              show
                ? <span className="text-white dark:text-gray-900 font-bold text-lg">{value[i]}</span>
                : <div className="w-3 h-3 rounded-full bg-white dark:bg-gray-900" />
            )}
          </div>
        ))}
      </div>

      {/* Hidden real input */}
      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        className="absolute opacity-0 w-0 h-0"
        autoComplete="off"
      />

      {/* Show/hide toggle */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setShow(!show); }}
        className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
      >
        {show ? <EyeOff size={12} /> : <Eye size={12} />}
        {show ? "Hide PIN" : "Show PIN"}
      </button>

      {/* Number pad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k, i) => (
          <button
            key={i}
            type="button"
            disabled={typeof k === "string" && k === ""}
            onClick={() => {
              if (k === "⌫") onChange(value.slice(0, -1));
              else if (k !== "") onChange(value + String(k));
              inputRef.current?.focus();
            }}
            className={`h-12 rounded-xl text-lg font-semibold transition-all active:scale-95 ${
              k === "" ? "pointer-events-none" :
              k === "⌫" ? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700" :
              "bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-sm text-red-500 font-medium">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP INDICATOR
══════════════════════════════════════════════════════════════ */
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
            current > i + 1
              ? "bg-green-500 text-white"
              : current === i + 1
              ? "bg-blue-600 text-white"
              : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600"
          }`}>
            {current > i + 1 ? <Check size={12} /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`w-8 h-0.5 rounded transition-all ${
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
  const navigate         = useNavigate();
  const [searchParams]   = useSearchParams();
  const { user, profile, refreshProfile } = useAuth();

  const mode = (searchParams.get("mode") || "change") as "create" | "change";
  const from = searchParams.get("from"); // e.g. "create-post"

  /* Force create mode if PIN not set yet */
  const isCreate = mode === "create" || !profile?.anon_pin_set;

  const totalSteps = isCreate ? 2 : 3;

  const [step,       setStep]       = useState(1);
  const [current,    setCurrent]    = useState(""); // existing PIN (change flow only)
  const [newPin,     setNewPin]     = useState("");
  const [confirm,    setConfirm]    = useState("");
  const [error,      setError]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [locked,     setLocked]     = useState(false);
  const [lockSecs,   setLockSecs]   = useState(0);
  const [done,       setDone]       = useState(false);

  /* Lock countdown */
  useEffect(() => {
    if (!locked) return;
    const iv = setInterval(() => {
      setLockSecs(s => {
        if (s <= 1) { setLocked(false); clearInterval(iv); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [locked]);

  const advance = async () => {
    setError("");
    setLoading(true);

    try {
      if (isCreate) {
        /* ── CREATE FLOW ── */
        if (step === 1) {
          if (newPin.length !== 4) { setError("PIN must be exactly 4 digits"); setLoading(false); return; }
          setStep(2);
        } else if (step === 2) {
          if (newPin !== confirm) { setError("PINs don't match. Try again."); setConfirm(""); setLoading(false); return; }
          /* Save new PIN */
          await setAnonPin(newPin);
          await refreshProfile();
          setDone(true);
          setTimeout(() => {
            navigate(from === "create-post" ? "/create-post" : "/settings", { replace: true });
          }, 1200);
        }
      } else {
        /* ── CHANGE FLOW ── */
        if (step === 1) {
          if (current.length !== 4) { setError("Enter your 4-digit current PIN"); setLoading(false); return; }
          /* Verify current PIN */
          const result = await verifyAnonPin(current);
          if (!result.success) {
            if (result.locked) {
              setLocked(true); setLockSecs(1800);
              setError("Too many attempts. Try again in 30 minutes.");
            } else {
              setError(`Incorrect PIN — ${result.attempts_left} attempts left`);
              setCurrent("");
            }
            setLoading(false);
            return;
          }
          setStep(2);
        } else if (step === 2) {
          if (newPin.length !== 4) { setError("PIN must be exactly 4 digits"); setLoading(false); return; }
          setStep(3);
        } else if (step === 3) {
          if (newPin !== confirm) { setError("PINs don't match. Try again."); setConfirm(""); setLoading(false); return; }
          /* Change PIN */
          await setAnonPin(newPin, current);
          await refreshProfile();
          setDone(true);
          setTimeout(() => {
            navigate(from === "create-post" ? "/create-post" : "/settings", { replace: true });
          }, 1200);
        }
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    }

    setLoading(false);
  };

  /* Current step value + setter */
  const stepValue = isCreate
    ? (step === 1 ? newPin : confirm)
    : (step === 1 ? current : step === 2 ? newPin : confirm);

  const stepSetter = isCreate
    ? (step === 1 ? setNewPin : setConfirm)
    : (step === 1 ? setCurrent : step === 2 ? setNewPin : setConfirm);

  const stepLabel = isCreate
    ? (step === 1 ? "Enter new PIN" : "Confirm PIN")
    : (step === 1 ? "Enter current PIN" : step === 2 ? "Enter new PIN" : "Confirm new PIN");

  const canAdvance = stepValue.length === 4 && !locked && !loading;

  /* ── Auto-advance when 4 digits entered ── */
  useEffect(() => {
    if (stepValue.length === 4 && !loading && !locked) {
      const t = setTimeout(() => advance(), 300);
      return () => clearTimeout(t);
    }
  }, [stepValue]);

  return (
    <AppShell>
      <div className="min-h-full bg-white dark:bg-gray-950">

        {/* Header — no mt-14, no sticky top-14 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="font-bold text-gray-900 dark:text-white text-base">
            {isCreate ? "Set Anon PIN" : "Change Anon PIN"}
          </h1>
        </div>

        <div className="flex flex-col items-center px-6 py-10 gap-8 max-w-sm mx-auto">

          {/* Icon */}
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
            done ? "bg-green-500" : "bg-gray-900 dark:bg-gray-800"
          }`}>
            {done
              ? <Check size={30} className="text-white" />
              : <Shield size={28} className="text-gray-200" />
            }
          </div>

          {done ? (
            /* ── Success state ── */
            <div className="text-center">
              <p className="font-bold text-gray-900 dark:text-white text-xl mb-1">
                {isCreate ? "PIN Created!" : "PIN Updated!"}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isCreate
                  ? "Your anonymous PIN has been set. You can now post anonymously."
                  : "Your anonymous PIN has been changed successfully."}
              </p>
            </div>
          ) : (
            <>
              {/* Step indicator */}
              <StepIndicator current={step} total={totalSteps} />

              {/* Description */}
              <div className="text-center">
                <p className="font-bold text-gray-900 dark:text-white text-lg mb-1">
                  {isCreate ? "Protect your anonymous identity" : "Change your anonymous PIN"}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  {step === 1 && isCreate
                    ? "Create a 4-digit PIN to post anonymously. Keep it safe."
                    : step === 1
                    ? "Verify your current PIN before setting a new one."
                    : step === 2 && !isCreate
                    ? "Enter your new 4-digit PIN."
                    : "Re-enter your PIN to confirm."}
                </p>
              </div>

              {/* Locked state */}
              {locked && (
                <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-xl px-4 py-3 text-sm text-orange-600 dark:text-orange-400">
                  <Lock size={14} />
                  <span>Locked — try again in <strong>{lockSecs}s</strong></span>
                </div>
              )}

              {/* PIN dots */}
              {!locked && (
                <PinDots
                  key={step}
                  label={stepLabel}
                  value={stepValue}
                  onChange={stepSetter}
                  error={error}
                  autoFocus={true}
                />
              )}

              {/* Loading */}
              {loading && (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Lock size={14} className="animate-pulse" /> Verifying…
                </div>
              )}

              {/* ── Anon avatar — coming soon ── */}
              {isCreate && step === 2 && (
                <div className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                    <ImageIcon size={16} className="text-gray-400 dark:text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Anon Profile Picture</p>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
                      Custom anonymous avatars — coming soon
                    </p>
                  </div>
                  <span className="ml-auto shrink-0 text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full">Soon</span>
                </div>
              )}

              {/* Manual continue button (fallback if auto-advance doesn't fire) */}
              {stepValue.length === 4 && !loading && !locked && (
                <button onClick={advance}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                  {loading
                    ? <><Lock size={14} className="animate-pulse" /> Verifying…</>
                    : step === totalSteps
                    ? <><Check size={14} /> {isCreate ? "Create PIN" : "Save New PIN"}</>
                    : "Continue →"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  ArrowLeft, Shield, Check, Lock, AlertCircle,
  Camera, Upload, X, Loader2,
} from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../contexts/AuthContext";
import { supabase, setAnonPin, verifyAnonPin } from "../lib/supabase";

/*
  AnonPinPage  —  /settings/anon-pin
  ?mode=create   first-time setup (avatar + PIN)
  ?mode=change   change existing PIN
  ?from=X        after success navigate back to /X

  DB NOTE: Run this SQL once to enable anon avatars:
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS anon_avatar_url text;

  CREATE FLOW:
    → Pick avatar (optional)
    → Enter PIN  (step 1)
    → Confirm PIN (step 2, live match feedback)
    → Save → back to ?from page

  CHANGE FLOW:
    → Verify current PIN
    → Enter new PIN
    → Confirm new PIN  (live match)
    → Save → back
*/

/* ─── Preset avatars ─────────────────────────────────────────── */
const PRESET_AVATARS = [
  { id: "ghost",   emoji: "👻", bg: "#6366f1" },
  { id: "ninja",   emoji: "🥷", bg: "#0f172a" },
  { id: "robot",   emoji: "🤖", bg: "#0891b2" },
  { id: "alien",   emoji: "👽", bg: "#16a34a" },
  { id: "panda",   emoji: "🐼", bg: "#374151" },
  { id: "fox",     emoji: "🦊", bg: "#ea580c" },
  { id: "cat",     emoji: "🐱", bg: "#7c3aed" },
  { id: "wolf",    emoji: "🐺", bg: "#1e40af" },
];

type PresetId = typeof PRESET_AVATARS[number]["id"];

interface AnonAvatar {
  type:   "preset" | "upload";
  presetId?: PresetId;
  uploadUrl?: string;   // object URL for preview
  uploadFile?: File;    // for upload
}

/* ─── Avatar picker ──────────────────────────────────────────── */
function AvatarPicker({
  value, onChange, anonUsername,
}: {
  value:        AnonAvatar | null;
  onChange:     (a: AnonAvatar | null) => void;
  anonUsername: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5MB"); return; }
    onChange({ type: "upload", uploadUrl: URL.createObjectURL(file), uploadFile: file });
  };

  const preset = value?.type === "preset"
    ? PRESET_AVATARS.find(p => p.id === value.presetId)
    : null;

  return (
    <div className="w-full">
      {/* Current avatar preview + username */}
      <div className="flex flex-col items-center gap-2 mb-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-gray-100 dark:ring-gray-800">
            {value?.type === "upload" && value.uploadUrl ? (
              <img src={value.uploadUrl} alt="anon" className="w-full h-full object-cover" />
            ) : preset ? (
              <div className="w-full h-full flex items-center justify-center text-4xl"
                style={{ background: preset.bg }}>
                {preset.emoji}
              </div>
            ) : (
              <div className="w-full h-full bg-gray-800 dark:bg-gray-700 flex items-center justify-center">
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

      {/* Preset grid */}
      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 text-center">
        Choose an avatar
      </p>
      <div className="grid grid-cols-4 gap-2.5 mb-3">
        {PRESET_AVATARS.map(p => (
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

      {/* Upload from device */}
      <button onClick={() => fileRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 transition-all">
        <Upload size={15} />
        Upload from device
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <p className="text-[11px] text-gray-400 dark:text-gray-600 text-center mt-1.5">
        Optional · JPG, PNG, WebP · max 5 MB
      </p>
    </div>
  );
}

/* ─── PIN row ────────────────────────────────────────────────── */
/*
  Each row = one PIN field.
  Uses a real <input type="tel" inputMode="numeric"> that the
  device keyboard opens. The 4 dot boxes are display-only.
  Tapping the row focuses the input → keyboard appears.
*/
function PinRow({
  label, value, onChange, match, autoFocus = false,
}: {
  label:      string;
  value:      string;
  onChange:   (v: string) => void;
  match?:     boolean | null;  // null = not yet shown, true = match, false = no match
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => ref.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  return (
    <div className="w-full" onClick={() => ref.current?.focus()}>
      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 text-center">
        {label}
      </p>

      {/* 4 dot boxes */}
      <div className="flex gap-3 justify-center mb-2">
        {[0,1,2,3].map(i => (
          <div key={i}
            className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center transition-all cursor-text select-none ${
              value.length > i
                ? "bg-gray-900 dark:bg-gray-100 border-gray-900 dark:border-gray-100"
                : value.length === i
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            }`}>
            {value.length > i && (
              <div className="w-3 h-3 rounded-full bg-white dark:bg-gray-900" />
            )}
          </div>
        ))}
      </div>

      {/* Hidden real input — device keyboard opens here */}
      <input
        ref={ref}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        className="sr-only"
        autoComplete="off"
        autoFocus={autoFocus}
      />

      {/* Live match feedback */}
      {match !== null && match !== undefined && value.length === 4 && (
        <div className={`flex items-center justify-center gap-1.5 text-xs font-semibold mt-2 transition-all ${
          match ? "text-green-500" : "text-red-500"
        }`}>
          {match
            ? <><Check size={13} /> PINs match</>
            : <><AlertCircle size={13} /> PINs don't match</>}
        </div>
      )}
    </div>
  );
}

/* ─── Step indicator ─────────────────────────────────────────── */
function Steps({ current, total }: { current: number; total: number }) {
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
   MAIN
══════════════════════════════════════════════════════════════ */
export function AnonPinPage() {
  const navigate       = useNavigate();
  const [params]       = useSearchParams();
  const { user, profile, refreshProfile } = useAuth();

  const from     = params.get("from");
  const isCreate = (params.get("mode") === "create") || !profile?.anon_pin_set;
  const totalSteps = isCreate ? 3 : 4; // create: avatar→pin→confirm | change: verify→avatar→pin→confirm

  /* State */
  const [step,      setStep]     = useState(1);
  const [avatar,    setAvatar]   = useState<AnonAvatar | null>(null);
  const [current,   setCurrent]  = useState("");
  const [newPin,    setNewPin]   = useState("");
  const [confirm,   setConfirm]  = useState("");
  const [error,     setError]    = useState("");
  const [loading,   setLoading]  = useState(false);
  const [locked,    setLocked]   = useState(false);
  const [lockSecs,  setLockSecs] = useState(0);
  const [done,      setDone]     = useState(false);

  /* Countdown */
  useEffect(() => {
    if (!locked) return;
    const iv = setInterval(() => {
      setLockSecs(s => { if (s <= 1) { setLocked(false); clearInterval(iv); return 0; } return s - 1; });
    }, 1000);
    return () => clearInterval(iv);
  }, [locked]);

  /* Live match: only show when confirm has 4 digits */
  const matchStatus: boolean | null = confirm.length === 4 ? (newPin === confirm) : null;

  /* Upload anon avatar to storage */
  const uploadAnonAvatar = async (): Promise<string | null> => {
    if (!avatar) return null;
    if (avatar.type === "preset") {
      // Store as preset identifier, not an image URL
      return `preset:${avatar.presetId}`;
    }
    if (avatar.type === "upload" && avatar.uploadFile && user?.id) {
      try {
        const ext  = avatar.uploadFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/anon_avatar.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, avatar.uploadFile, { upsert: true });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        return data.publicUrl;
      } catch (e) {
        console.error("Anon avatar upload failed:", e);
        return null;
      }
    }
    return null;
  };

  /* Save avatar to profile */
  const saveAvatar = async () => {
    if (!user?.id) return;
    const url = await uploadAnonAvatar();
    if (!url) return;
    await supabase.from("profiles")
      .update({ anon_avatar_url: url, updated_at: new Date().toISOString() })
      .eq("id", user.id);
  };

  const goBack = () => {
    if (from) navigate(`/${from}`, { replace: true });
    else navigate(-1);
  };

  const advance = async () => {
    setError(""); setLoading(true);
    try {
      if (isCreate) {
        // Steps: 1=avatar, 2=new pin, 3=confirm
        if (step === 1) {
          setStep(2); // avatar is optional, always advance
        } else if (step === 2) {
          if (newPin.length !== 4) { setError("Enter 4 digits"); setLoading(false); return; }
          setStep(3);
        } else if (step === 3) {
          if (newPin !== confirm) { setError("PINs don't match"); setConfirm(""); setLoading(false); return; }
          await setAnonPin(newPin);
          await saveAvatar();
          await refreshProfile();
          setDone(true);
          setTimeout(goBack, 1200);
        }
      } else {
        // Steps: 1=verify current, 2=avatar, 3=new pin, 4=confirm
        if (step === 1) {
          if (current.length !== 4) { setError("Enter your 4-digit PIN"); setLoading(false); return; }
          const result = await verifyAnonPin(current);
          if (!result.success) {
            if (result.locked) { setLocked(true); setLockSecs(1800); setError("Too many attempts. Locked 30 min."); }
            else { setError(`Incorrect PIN — ${result.attempts_left} left`); setCurrent(""); }
            setLoading(false); return;
          }
          setStep(2);
        } else if (step === 2) {
          setStep(3);
        } else if (step === 3) {
          if (newPin.length !== 4) { setError("Enter 4 digits"); setLoading(false); return; }
          setStep(4);
        } else if (step === 4) {
          if (newPin !== confirm) { setError("PINs don't match"); setConfirm(""); setLoading(false); return; }
          await setAnonPin(newPin, current);
          await saveAvatar();
          await refreshProfile();
          setDone(true);
          setTimeout(goBack, 1200);
        }
      }
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    }
    setLoading(false);
  };

  /* Auto-advance for PIN rows */
  const pinStep   = isCreate ? 2 : 3;
  const confStep  = isCreate ? 3 : 4;
  const verifyStep = isCreate ? -1 : 1;

  useEffect(() => {
    if (step === verifyStep && current.length === 4) {
      const t = setTimeout(advance, 300); return () => clearTimeout(t);
    }
  }, [current]);

  useEffect(() => {
    if (step === pinStep && newPin.length === 4) {
      const t = setTimeout(advance, 300); return () => clearTimeout(t);
    }
  }, [newPin]);

  // Confirm: only auto-advance if they match
  useEffect(() => {
    if (step === confStep && confirm.length === 4 && newPin === confirm) {
      const t = setTimeout(advance, 500); return () => clearTimeout(t);
    }
  }, [confirm]);

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

          {/* Done */}
          {done ? (
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
              {/* Icon */}
              <div className="w-14 h-14 rounded-2xl bg-gray-900 dark:bg-gray-800 flex items-center justify-center">
                <Shield size={26} className="text-gray-200" />
              </div>

              <Steps current={step} total={totalSteps} />

              {/* Locked */}
              {locked && (
                <div className="w-full flex items-center gap-2 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-xl px-4 py-3 text-sm text-orange-600 dark:text-orange-400">
                  <Lock size={14} className="shrink-0" />
                  <span>Too many attempts — try again in <strong>{lockSecs}s</strong></span>
                </div>
              )}

              {/* STEP: Avatar picker (steps 1 for create, step 2 for change) */}
              {((isCreate && step === 1) || (!isCreate && step === 2)) && (
                <>
                  <div className="text-center">
                    <p className="font-bold text-gray-900 dark:text-white text-lg">Choose your anon avatar</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">This is optional — skip to set your PIN</p>
                  </div>
                  <AvatarPicker value={avatar} onChange={setAvatar} anonUsername={anonUsername} />
                  <button onClick={advance}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 active:scale-95 transition-all">
                    {avatar ? "Save & Continue →" : "Skip & Continue →"}
                  </button>
                </>
              )}

              {/* STEP: Verify current PIN (change flow step 1) */}
              {!isCreate && step === 1 && !locked && (
                <>
                  <div className="text-center">
                    <p className="font-bold text-gray-900 dark:text-white text-lg">Verify current PIN</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Enter your existing 4-digit PIN</p>
                  </div>
                  <PinRow label="Current PIN" value={current} onChange={setCurrent} autoFocus={true} />
                  {loading && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={14} className="animate-spin" /> Verifying…</div>}
                  {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}
                </>
              )}

              {/* STEP: Enter new PIN */}
              {step === pinStep && (
                <>
                  <div className="text-center">
                    <p className="font-bold text-gray-900 dark:text-white text-lg">Set your PIN</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Choose a 4-digit PIN to post anonymously</p>
                  </div>
                  <PinRow label="New PIN" value={newPin} onChange={setNewPin} autoFocus={true} />
                  {loading && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={14} className="animate-spin" /> Saving…</div>}
                  {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}
                </>
              )}

              {/* STEP: Confirm PIN */}
              {step === confStep && (
                <>
                  <div className="text-center">
                    <p className="font-bold text-gray-900 dark:text-white text-lg">Confirm your PIN</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Re-enter to confirm</p>
                  </div>
                  <PinRow
                    label="Confirm PIN"
                    value={confirm}
                    onChange={setConfirm}
                    match={matchStatus}
                    autoFocus={true}
                  />
                  {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}
                  {loading && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={14} className="animate-spin" /> Setting PIN…</div>}
                  {/* Manual button — active only when match */}
                  <button
                    onClick={advance}
                    disabled={matchStatus !== true || loading}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                      matchStatus === true && !loading
                        ? "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
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

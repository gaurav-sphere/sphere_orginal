import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft, ChevronRight, Lock, Eye, Bell, Shield,
  User, Info, LogOut, X, EyeOff, Loader2,
} from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

/* ══════════════════════════════════════════════════════════════
   RE-AUTH MODAL — real Supabase password verification
══════════════════════════════════════════════════════════════ */
function ReauthModal({ email, onSuccess, onCancel }: {
  email: string; onSuccess: () => void; onCancel: () => void;
}) {
  const [pass,    setPass]    = useState("");
  const [show,    setShow]    = useState(false);
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    if (!pass) { setError("Enter your password"); return; }
    setLoading(true); setError("");
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: pass });
    setLoading(false);
    if (authErr) { setError("Incorrect password. Try again."); setPass(""); return; }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel}/>
      <div className="relative w-full max-w-sm mx-auto bg-white dark:bg-gray-900 rounded-t-3xl lg:rounded-3xl p-6 shadow-2xl">
        <button onClick={onCancel}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500">
          <X size={16}/>
        </button>
        <div className="flex flex-col items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center">
            <Lock size={22} className="text-blue-600 dark:text-blue-400"/>
          </div>
          <div className="text-center">
            <h2 className="font-bold text-gray-900 dark:text-white">Confirm it's you</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Enter your password to access Settings</p>
          </div>
        </div>
        <div className="relative mb-3">
          <input
            type={show ? "text" : "password"}
            value={pass}
            onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === "Enter" && confirm()}
            placeholder="Your password"
            autoFocus
            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 pr-10 text-gray-900 dark:text-white transition-all"
          />
          <button onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {show ? <EyeOff size={16}/> : <Eye size={16}/>}
          </button>
        </div>
        {error && <p className="text-red-500 text-xs mb-3 font-medium">{error}</p>}
        <button onClick={confirm} disabled={loading}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-60 transition-all flex items-center justify-center gap-2">
          {loading ? <><Loader2 size={14} className="animate-spin"/> Verifying…</> : "Confirm"}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TOGGLE SWITCH
══════════════════════════════════════════════════════════════ */
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div onClick={e => { e.stopPropagation(); onChange(); }}
      className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors shrink-0 ${checked ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"}`}>
      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}/>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SETTINGS ITEM
══════════════════════════════════════════════════════════════ */
function Item({ icon: Icon, label, sub, onClick, danger = false, toggle, checked, color = "text-blue-600" }: {
  icon: React.ElementType; label: string; sub?: string; onClick?: () => void;
  danger?: boolean; toggle?: boolean; checked?: boolean; color?: string;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-3.5 transition-colors border-b border-gray-50 dark:border-gray-800/60 text-left ${
        danger ? "hover:bg-red-50 dark:hover:bg-red-950/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
      }`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${danger ? "bg-red-50 dark:bg-red-950/30" : "bg-gray-50 dark:bg-gray-800"}`}>
        <Icon size={17} className={danger ? "text-red-500" : color}/>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${danger ? "text-red-500" : "text-gray-900 dark:text-white"}`}>{label}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
      {toggle != null ? (
        <Toggle checked={!!checked} onChange={onClick || (() => {})}/>
      ) : !danger ? (
        <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 shrink-0"/>
      ) : null}
    </button>
  );
}

function Section({ title }: { title: string }) {
  return <div className="px-4 pt-5 pb-1"><p className="text-[11px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-wider">{title}</p></div>;
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export function SettingsPage() {
  const navigate           = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  const [authed,         setAuthed]         = useState(false);
  const [showReauth,     setShowReauth]     = useState(true);
  const [savingPrivate,  setSavingPrivate]  = useState(false);

  /* Notification prefs — no DB columns, persisted in localStorage */
  const NOTIF_KEY = "sphere_notif_prefs";
  const defaultNotifs = { praise: true, forward: true, thought: true, follow: true, msg: true, push: false };
  const [notifs, setNotifs] = useState(() => {
    try { return { ...defaultNotifs, ...JSON.parse(localStorage.getItem(NOTIF_KEY) || "{}") }; } catch { return defaultNotifs; }
  });

  const setNotif = (key: keyof typeof defaultNotifs) => {
    const next = { ...notifs, [key]: !notifs[key] };
    setNotifs(next);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
  };

  /* Private account — real value from profile, saved to DB */
  const [isPrivate, setIsPrivate] = useState(false);
  useEffect(() => { if (profile) setIsPrivate((profile as any).is_private || false); }, [profile]);

  const togglePrivate = async () => {
    if (!user?.id || savingPrivate) return;
    const next = !isPrivate;
    setIsPrivate(next);
    setSavingPrivate(true);
    await supabase.from("profiles").update({ is_private: next, updated_at: new Date().toISOString() }).eq("id", user.id);
    await refreshProfile();
    setSavingPrivate(false);
  };

  /* Logout — real signOut */
  const handleLogout = async () => {
    sessionStorage.clear();
    await supabase.auth.signOut();
    window.location.replace("/");
  };

  /* Email for reauth */
  const email = (profile as any)?.email || user?.email || "";

  if (showReauth && !authed) {
    return <ReauthModal email={email} onSuccess={() => { setAuthed(true); setShowReauth(false); }} onCancel={() => navigate(-1)}/>;
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

        {/* Header — no mt-14 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300"/>
          </button>
          <h1 className="font-bold text-gray-900 dark:text-white">Settings</h1>
        </div>

        <div className="bg-white dark:bg-gray-900">

          {/* ── Account ── */}
          <Section title="Account"/>
          <Item icon={User}  label="Account Info"     sub="Email, phone, joined date"  onClick={() => navigate("/settings/account-info")} color="text-gray-600 dark:text-gray-400"/>
          <Item icon={Lock}  label="Change Password"  sub="Update your password"       onClick={() => navigate("/settings/change-password")} color="text-gray-600 dark:text-gray-400"/>

          {/* ── Privacy ── */}
          <Section title="Privacy"/>
          <Item icon={Eye}   label="Private Account"  sub={isPrivate ? "Only followers can see your quotes" : "Anyone can see your quotes"}
            toggle checked={isPrivate} onClick={togglePrivate}/>
          <Item icon={User}  label="Message Settings" sub="Who can send you DMs"       onClick={() => navigate("/messages/settings")} color="text-gray-600 dark:text-gray-400"/>
          <Item icon={User}  label="Blocked Users"    sub="Manage blocked accounts"    onClick={() => navigate("/messages/blocked")} color="text-gray-600 dark:text-gray-400"/>

          {/* ── Notifications ── */}
          <Section title="Notifications"/>
          <Item icon={Bell}  label="Push Notifications" sub="Get notified on your device" toggle checked={notifs.push} onClick={() => setNotif("push")}/>
          <Item icon={Bell}  label="Praises"            toggle checked={notifs.praise}   onClick={() => setNotif("praise")}/>
          <Item icon={Bell}  label="Forwards"           toggle checked={notifs.forward}  onClick={() => setNotif("forward")}/>
          <Item icon={Bell}  label="Thoughts"           toggle checked={notifs.thought}  onClick={() => setNotif("thought")}/>
          <Item icon={Bell}  label="New Followers"      toggle checked={notifs.follow}   onClick={() => setNotif("follow")}/>
          <Item icon={Bell}  label="Messages"           toggle checked={notifs.msg}      onClick={() => setNotif("msg")}/>

          {/* ── Anonymous Identity ── */}
          <Section title="Anonymous Identity"/>
          <Item icon={Shield} label="Anon Username"
            sub={profile?.anon_username ? `@${profile.anon_username} · Permanent` : "Your anonymous username"}
            color="text-gray-600 dark:text-gray-400" onClick={() => {}}/>
          <Item icon={Shield} label="Change Anon PIN"  sub="Update your 4-digit anon PIN" onClick={() => navigate("/settings/anon-pin")} color="text-blue-600"/>

          {/* ── About ── */}
          <Section title="About"/>
          <Item icon={Info}   label="About Sphere"     sub="Version 2.0"  onClick={() => {}} color="text-gray-600 dark:text-gray-400"/>

          {/* ── Danger zone ── */}
          <Section title="Account Actions"/>
          <Item icon={LogOut} label="Logout" danger onClick={handleLogout}/>
        </div>

        <div className="h-10"/>
      </div>
    </AppShell>
  );
}

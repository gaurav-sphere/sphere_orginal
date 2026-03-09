import React, { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, ChevronRight, Lock, Eye, Bell, Shield, User, Info, LogOut, X, Eye as EyeIcon, EyeOff } from "lucide-react";
import { AppShell } from "../components/AppShell";

/* ── Re-auth modal ── */
function ReauthModal({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    if (!pass) { setError("Enter your password"); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setLoading(false);
    // Demo: any password works
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm mx-auto bg-white rounded-t-3xl lg:rounded-3xl p-6 shadow-2xl sheet-up">
        <button onClick={onCancel} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"><X size={16} /></button>
        <div className="flex flex-col items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center"><Lock size={22} className="text-blue-600" /></div>
          <div className="text-center">
            <h2 className="font-bold text-gray-900">Confirm it's you</h2>
            <p className="text-sm text-gray-500 mt-1">Enter your password to continue</p>
          </div>
        </div>
        <div className="relative mb-3">
          <input type={show?"text":"password"} value={pass} onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key==="Enter" && confirm()}
            placeholder="Your password"
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 pr-10 transition-all" />
          <button onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {show ? <EyeOff size={16} /> : <EyeIcon size={16} />}
          </button>
        </div>
        {error && <p className="text-red-500 text-xs mb-3 font-medium">{error}</p>}
        <button onClick={confirm} disabled={loading}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-60 transition-all">
          {loading ? "Verifying…" : "Confirm"}
        </button>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const [showReauth, setShowReauth] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [privateAccount, setPrivateAccount] = useState(false);
  const [notifPraise, setNotifPraise] = useState(true);
  const [notifForward, setNotifForward] = useState(true);
  const [notifThought, setNotifThought] = useState(true);
  const [notifFollow, setNotifFollow] = useState(true);
  const [notifMsg, setNotifMsg] = useState(true);
  const [pushNotif, setPushNotif] = useState(false);

  if (showReauth && !authed) {
    return <ReauthModal onSuccess={() => { setAuthed(true); setShowReauth(false); }} onCancel={() => navigate(-1)} />;
  }

  const Section = ({ title }: { title: string }) => (
    <div className="px-4 pt-5 pb-1"><p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{title}</p></div>
  );
  const Item = ({ icon: Icon, label, sub, onClick, danger = false, toggle, checked, onToggle, color = "text-blue-600" }: any) => (
    <button onClick={onClick ?? onToggle}
      className={`flex items-center gap-3 w-full px-4 py-3.5 hover:bg-gray-50 transition-colors border-b border-gray-50 text-left ${danger?"hover:bg-red-50":""}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${danger?"bg-red-50":"bg-gray-50"}`}>
        <Icon size={17} className={danger?"text-red-500":color} />
      </div>
      <div className="flex-1">
        <p className={`text-sm font-semibold ${danger?"text-red-500":"text-gray-900"}`}>{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {toggle != null ? (
        <div className={`relative w-10 h-5.5 rounded-full transition-colors ${checked?"bg-blue-600":"bg-gray-300"}`}
          onClick={e => { e.stopPropagation(); onToggle?.(); }}>
          <div className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-all ${checked?"left-5":"left-0.5"}`} style={{ width:18, height:18 }} />
        </div>
      ) : (
        !danger && <ChevronRight size={16} className="text-gray-300" />
      )}
    </button>
  );

  return (
    <AppShell>
      <div className="page-enter mt-14 lg:mt-0 min-h-screen bg-gray-50">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white sticky top-14 lg:top-0 z-10">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="font-bold text-gray-900">Settings</h1>
        </div>

        <div className="bg-white">
          <Section title="Account" />
          <Item icon={User} label="Account Info" sub="Email, phone, joined date" onClick={() => navigate("/settings/account-info")} color="text-gray-600" />
          <Item icon={Lock} label="Change Password" sub="Update your password" onClick={() => {}} color="text-gray-600" />
          <Item icon={User} label="Change Email" onClick={() => {}} color="text-gray-600" />

          <Section title="Privacy" />
          <Item icon={Eye} label="Private Account" sub="Only followers can see your quotes"
            toggle onToggle={() => setPrivateAccount(p => !p)} checked={privateAccount} />
          <Item icon={User} label="Who can send DMs" onClick={() => {}} color="text-gray-600" />
          <Item icon={Eye} label="Who can see followers" onClick={() => {}} color="text-gray-600" />

          <Section title="Notifications" />
          <Item icon={Bell} label="Push Notifications" sub="Get notified on your device"
            toggle onToggle={() => setPushNotif(p => !p)} checked={pushNotif} />
          <Item icon={Bell} label="Praises" toggle onToggle={() => setNotifPraise(p => !p)} checked={notifPraise} />
          <Item icon={Bell} label="Forwards" toggle onToggle={() => setNotifForward(p => !p)} checked={notifForward} />
          <Item icon={Bell} label="Thoughts" toggle onToggle={() => setNotifThought(p => !p)} checked={notifThought} />
          <Item icon={Bell} label="New Followers" toggle onToggle={() => setNotifFollow(p => !p)} checked={notifFollow} />
          <Item icon={Bell} label="Messages" toggle onToggle={() => setNotifMsg(p => !p)} checked={notifMsg} />

          <Section title="Security" />
          <Item icon={Shield} label="Active Sessions" sub="Devices logged in" onClick={() => {}} color="text-gray-600" />
          <Item icon={Shield} label="Sign Out All Devices" onClick={() => {}} color="text-gray-600" />

          <Section title="Anonymous Identity" />
          <Item icon={Shield} label="Anon Username" sub="shadow_voice_77 · Permanent" color="text-gray-600" onClick={() => {}} />
          <Item icon={Shield} label="Change Anon PIN" sub="Update your 4-digit anon PIN" onClick={() => navigate("/settings/anon-pin")} color="text-blue-600" />

          <Section title="More" />
          <Item icon={Info} label="Account Info" onClick={() => navigate("/settings/account-info")} color="text-gray-600" />
          <Item icon={LogOut} label="Logout" danger onClick={() => navigate("/login")} />
        </div>
        <div className="h-8" />
      </div>
    </AppShell>
  );
}

import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { supabase } from "../lib/supabase";

/* ═══════════════════════ PHOSPHOR-STYLE SVG ICONS ══════════════════════════ */
type IconProps = { size?: number; className?: string };
const ic = (path: string) => ({ size = 20, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
    className={className}>
    {typeof path === "string" ? <path d={path} /> : path}
  </svg>
);

const IcoHome        = ic("M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5zM9 21V12h6v9");
const IcoSearch      = ic("M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35");
const IcoCreate      = ic("M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z");
const IcoMessages    = ({ size=20, className="" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
    className={className}>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
);
const IcoProfile     = ic("M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z");
const IcoBell        = ic("M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0");
const IcoSettings    = ({ size=20, className="" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
    className={className}>
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
);
const IcoLogout      = ic("M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9");
const IcoHelp        = ic("M12 22a10 10 0 110-20 10 10 0 010 20zM9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01");
const IcoMoon        = ic("M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z");
const IcoSun         = ({ size=20, className="" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
    className={className}>
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);
const IcoShield      = ic("M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z");

/* ═══════════════════════════ TYPES ═════════════════════════════════════════ */
interface Notification {
  id: string; type: string; is_read: boolean; created_at: string; text?: string | null;
  actor: { name: string; username: string; avatar_url: string } | null;
}
interface AppShellProps { children: React.ReactNode }

/* ═══════════════════════ SETTINGS RE-AUTH MODAL ════════════════════════════ */
function SettingsAuthModal({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const verify = async () => {
    if (!password.trim() || !user?.email) return;
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.signInWithPassword({
      email: user.email, password,
    });
    setLoading(false);
    if (err) { setError("Incorrect password. Try again."); return; }
    sessionStorage.setItem("sphere_settings_auth", "1");
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h2 className="font-bold text-gray-900 dark:text-white text-lg mb-1">Verify it's you</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Enter your password to access Settings</p>
        <input
          type="password" value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && verify()}
          placeholder="Your password"
          autoFocus
          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
        />
        {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
        <div className="flex gap-2 mt-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Cancel
          </button>
          <button onClick={verify} disabled={loading || !password}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? "Checking…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════ APPSHELL ══════════════════════════════════════ */
export function AppShell({ children }: AppShellProps) {
  const navigate   = useNavigate();
  const { pathname } = useLocation();
  const { user, profile, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [showNotif, setShowNotif]           = useState(false);
  const [showCreate, setShowCreate]         = useState(false);
  const [notifications, setNotifications]   = useState<Notification[]>([]);
  const [unread, setUnread]                 = useState(0);
  const [showSettingsAuth, setShowSettingsAuth] = useState(false);

  /* ── Fetch notifications ── */
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("notifications")
      .select(`id, type, is_read, created_at, text,
        actor:profiles!notifications_actor_id_fkey(name, username, avatar_url)`)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (data) {
          setNotifications(data as unknown as Notification[]);
          setUnread(data.filter((n: any) => !n.is_read).length);
        }
      });
  }, [user?.id]);

  /* ── Mark read when panel opens ── */
  useEffect(() => {
    if (!showNotif || !user?.id || unread === 0) return;
    supabase.from("notifications").update({ is_read: true })
      .eq("user_id", user.id).eq("is_read", false)
      .then(() => setUnread(0));
  }, [showNotif, user?.id]);

  const formatNotif = (n: Notification) => {
    const who = n.actor?.name || "Someone";
    switch (n.type) {
      case "praise":      return `${who} praised your quote`;
      case "thought":     return `${who} replied to your quote`;
      case "follow":      return `${who} started following you`;
      case "forward":     return `${who} forwarded your quote`;
      case "mention":     return `${who} mentioned you`;
      case "story_reply": return `${who} replied to your story`;
      default:            return n.text || "New notification";
    }
  };

  const handleLogout = async () => { await signOut(); navigate("/"); };

  const handleSettingsClick = () => {
    if (sessionStorage.getItem("sphere_settings_auth")) { navigate("/settings"); return; }
    setShowSettingsAuth(true);
  };

  const hideBottomNav =
    pathname.startsWith("/create-post") || pathname.startsWith("/feed/search") ||
    pathname.startsWith("/messages")    || pathname.startsWith("/thoughts/")    ||
    pathname.startsWith("/status")      || pathname === "/profile"              ||
    pathname.startsWith("/profile/");

  const isActive = (path: string) =>
    path === "/feed" ? pathname === "/feed" : pathname === path || pathname.startsWith(path + "/");

  const navItems = [
    { path: "/feed",        Icon: IcoHome,     label: "Home"         },
    { path: "/feed/search", Icon: IcoSearch,   label: "Search"       },
    { path: "/create-post", Icon: IcoCreate,   label: "Create Quote" },
    { path: "/messages",    Icon: IcoMessages, label: "Messages"     },
    { path: "/profile",     Icon: IcoProfile,  label: "Profile"      },
  ];

  /* ── Logo block ── */
  const Logo = () => (
    <button onClick={() => navigate("/feed")} className="flex items-center gap-2.5 group">
      <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm group-hover:bg-blue-700 transition-colors shrink-0">
        <span className="text-white text-[17px] leading-none" style={{ fontFamily: "'Pacifico',cursive" }}>s</span>
      </div>
      <span className="text-blue-600 dark:text-blue-400 text-xl font-normal leading-none hidden lg:block"
        style={{ fontFamily: "'Pacifico',cursive" }}>sphere</span>
    </button>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">

      {/* ═══ DESKTOP TOP HEADER ═══ */}
      <header className="hidden lg:flex items-center bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-3 z-30 shadow-sm shrink-0">
        <div className="flex-1">
          <Logo />
        </div>
        <div className="flex-1 flex justify-center">
          <span className="text-blue-600 dark:text-blue-400 text-2xl font-normal"
            style={{ fontFamily: "'Pacifico',cursive" }}>sphere</span>
        </div>
        <div className="flex-1 flex justify-end">
          <button onClick={() => setShowNotif(!showNotif)}
            className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <IcoBell size={20} className="text-gray-600 dark:text-gray-300" />
            {unread > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ═══ MOBILE TOP HEADER ═══ */}
      <div className="lg:hidden flex items-center justify-between bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 z-30 shadow-sm shrink-0">
        <button onClick={() => navigate("/feed")}
          className="text-blue-600 dark:text-blue-400 text-xl font-normal leading-none"
          style={{ fontFamily: "'Pacifico',cursive" }}>
          sphere
        </button>
        <div className="flex items-center gap-1">
          {/* Dark mode toggle */}
          <button onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            {isDark
              ? <IcoSun size={19} className="text-yellow-500" />
              : <IcoMoon size={19} className="text-gray-500 dark:text-gray-400" />}
          </button>
          {/* Bell */}
          <button onClick={() => setShowNotif(!showNotif)}
            className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <IcoBell size={20} className="text-gray-600 dark:text-gray-300" />
            {unread > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ═══ DESKTOP LEFT SIDEBAR ═══ */}
        <aside className="hidden lg:flex flex-col w-60 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 shrink-0 overflow-y-auto">

          {/* Section 1: Navigation (75%) */}
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {navItems.map(({ path, Icon, label }) => (
              <button key={path}
                onClick={() => navigate(path)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive(path)
                    ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                }`}>
                <Icon size={20} className={isActive(path) ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"} />
                {label}
              </button>
            ))}
          </nav>

          {/* Thin divider */}
          <div className="mx-4 h-px bg-gray-100 dark:bg-gray-800" />

          {/* Section 2: Profile card */}
          {profile && (
            <button onClick={() => navigate("/profile")}
              className="mx-3 my-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group">
              <div className="flex items-center gap-2.5">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.name}
                    className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-white dark:ring-gray-800" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center shrink-0 text-white font-bold text-sm">
                    {profile.name?.[0]?.toUpperCase() || "U"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {profile.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">@{profile.username}</p>
                </div>
              </div>
            </button>
          )}

          {/* Thin divider */}
          <div className="mx-4 h-px bg-gray-100 dark:bg-gray-800" />

          {/* Section 3: Utilities */}
          <div className="px-3 py-3 space-y-0.5">
            {/* Dark mode toggle */}
            <button onClick={toggleTheme}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all">
              {isDark ? <IcoSun size={18} className="text-yellow-500" /> : <IcoMoon size={18} className="text-gray-400" />}
              {isDark ? "Light Mode" : "Dark Mode"}
            </button>
            {/* Settings */}
            <button onClick={handleSettingsClick}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all">
              <IcoSettings size={18} className="text-gray-400 dark:text-gray-500" />
              Settings
            </button>
            {/* Logout */}
            <button onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 transition-all">
              <IcoLogout size={18} />
              Logout
            </button>
          </div>
        </aside>

        {/* ═══ MAIN CONTENT ═══ */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-gray-50 dark:bg-gray-950">
          {children}
        </main>
      </div>

      {/* ═══ MOBILE BOTTOM NAV ═══ */}
      {!hideBottomNav && (
        <nav className="lg:hidden bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 shrink-0 z-30"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <div className="flex items-center justify-around px-2 pt-1 pb-1 max-w-lg mx-auto">
            {/* Home */}
            <MobileBtn icon={IcoHome} label="Home" active={isActive("/feed")} onClick={() => navigate("/feed")} />
            {/* Search */}
            <MobileBtn icon={IcoSearch} label="Search" active={isActive("/feed/search")} onClick={() => navigate("/feed/search")} />
            {/* Create FAB — circular, centred, direct navigate */}
            <button onClick={() => navigate("/create-post")}
              className="w-[52px] h-[52px] -mt-5 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30 hover:bg-blue-700 active:scale-95 transition-all">
              <IcoCreate size={21} className="text-white" />
            </button>
            {/* Messages */}
            <MobileBtn icon={IcoMessages} label="Messages" active={isActive("/messages")} onClick={() => navigate("/messages")} badge={unread > 0 ? unread : undefined} />
            {/* Profile */}
            <MobileBtn icon={IcoProfile} label="Profile" active={isActive("/profile")} onClick={() => navigate("/profile")} />
          </div>
        </nav>
      )}

      {/* ═══ NOTIFICATION PANEL ═══ */}
      {showNotif && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setShowNotif(false)} />
          <div className="fixed top-14 right-4 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl w-80 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Notifications</h3>
              <button onClick={() => setShowNotif(false)}>
                <span className="text-gray-400 text-lg leading-none">×</span>
              </button>
            </div>
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                <IcoBell size={28} className="mx-auto mb-2 text-gray-200 dark:text-gray-700" />
                No notifications yet
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-800 ${!n.is_read ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}>
                  {n.actor?.avatar_url ? (
                    <img src={n.actor.avatar_url} alt={n.actor.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                      <IcoShield size={14} className="text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-800 dark:text-gray-200 leading-snug">{formatNotif(n)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(n.created_at).toLocaleString("en-IN", { hour:"numeric", minute:"2-digit", day:"numeric", month:"short" })}
                    </p>
                  </div>
                  {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ═══ CREATE POST DIALOG ═══ */}
      {showCreate && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowCreate(false)} />
          <div className="fixed bottom-24 lg:bottom-auto lg:left-64 lg:top-1/2 lg:-translate-y-1/2 left-1/2 -translate-x-1/2 lg:translate-x-4 z-50 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-72 overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">What kind of post?</h3>
              <p className="text-xs text-gray-400 mt-0.5">Choose how you want to share</p>
            </div>
            <button className="flex items-center gap-4 w-full px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              onClick={() => { setShowCreate(false); navigate("/create-post"); }}>
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-950 rounded-xl flex items-center justify-center">
                <IcoCreate size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Create Post</p>
                <p className="text-xs text-gray-400">Post as yourself</p>
              </div>
            </button>
            <div className="h-px bg-gray-50 dark:bg-gray-800" />
            <button className="flex items-center gap-4 w-full px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              onClick={() => { setShowCreate(false); navigate("/create-post?mode=anon"); }}>
              <div className="w-10 h-10 bg-gray-800 dark:bg-gray-700 rounded-xl flex items-center justify-center">
                <IcoShield size={18} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Anonymous Post</p>
                <p className="text-xs text-gray-400">Hide your identity</p>
              </div>
            </button>
          </div>
        </>
      )}

      {/* ═══ SETTINGS RE-AUTH MODAL ═══ */}
      {showSettingsAuth && (
        <SettingsAuthModal
          onSuccess={() => { setShowSettingsAuth(false); navigate("/settings"); }}
          onClose={() => setShowSettingsAuth(false)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ MOBILE NAV BUTTON ════════════════════════════════ */
function MobileBtn({ icon: Icon, label, active, onClick, badge }: {
  icon: React.FC<IconProps>; label: string; active: boolean;
  onClick: () => void; badge?: number;
}) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-colors relative ${
        active ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
      }`}>
      {badge && badge > 0 && (
        <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[8px] flex items-center justify-center font-bold">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
      <Icon size={22} className={active ? "text-blue-600 dark:text-blue-400" : ""} />
      <span className={`text-[10px] font-medium ${active ? "text-blue-600 dark:text-blue-400" : ""}`}>{label}</span>
    </button>
  );
}

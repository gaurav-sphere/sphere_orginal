import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { supabase } from "../lib/supabase";
import { LoginPromotionPanel } from "./LoginPromotionPanel";

/* ── Theme transition CSS — identical to GuestShell ── */
const THEME_TRANSITION_CSS = `
  *, *::before, *::after {
    transition-property: background-color, color, border-color, box-shadow, fill, stroke !important;
    transition-duration: 380ms !important;
    transition-timing-function: ease !important;
  }
  button:active *, a:active * {
    transition-duration: 80ms !important;
  }
`;
let themeStyleInjected = false;
function injectThemeTransitionCSS() {
  if (themeStyleInjected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.id = "sphere-theme-transition";
  style.textContent = THEME_TRANSITION_CSS;
  document.head.appendChild(style);
  themeStyleInjected = true;
}

/* ═══════════════════════ SVG ICONS ════════════════════════════════════════ */
type IconProps = { size?: number; className?: string };
const ic = (d: string) => ({ size = 20, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
    className={className}>
    <path d={d} />
  </svg>
);

const IcoHome     = ic("M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5zM9 21V12h6v9");
const IcoSearch   = ic("M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35");
const IcoCreate   = ic("M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z");
const IcoMessages = ic("M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z");
const IcoProfile  = ic("M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z");
const IcoBell     = ic("M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0");
const IcoStatus   = ic("M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z");
const IcoHelp     = ic("M12 22a10 10 0 110-20 10 10 0 010 20zM9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01");
const IcoLogout   = ic("M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9");
const IcoShield   = ic("M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z");
const IcoMoon     = ic("M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z");

const IcoSun = ({ size = 20, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
    className={className}>
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1"      x2="12" y2="3"     />
    <line x1="12" y1="21"     x2="12" y2="23"    />
    <line x1="4.22" y1="4.22"   x2="5.64" y2="5.64"  />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1"  y1="12"     x2="3"  y2="12"    />
    <line x1="21" y1="12"     x2="23" y2="12"    />
    <line x1="4.22" y1="19.78"  x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22" />
  </svg>
);

const IcoSettings = ({ size = 20, className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
    className={className}>
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
);

/* ═══════════════════════════ TYPES ════════════════════════════════════════ */
interface Notification {
  id: string; type: string; is_read: boolean; created_at: string;
  text?: string | null; post_id?: string | null;
  actor: { name: string; username: string; avatar_url: string } | null;
}
interface AppShellProps { children: React.ReactNode }

/* ═══════════════════ SETTINGS RE-AUTH MODAL ══════════════════════════════ */
function SettingsAuthModal({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const verify = async () => {
    if (!password.trim() || !user?.email) return;
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email: user.email, password });
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
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && verify()} placeholder="Your password" autoFocus
          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2" />
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

/* ═══════════════════════════ APP SHELL ════════════════════════════════════ */
export function AppShell({ children }: AppShellProps) {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const { user, profile, signOut } = useAuth();

  /* Safe theme access — same pattern as GuestShell */
  let isDark      = false;
  let toggleTheme = () => {};
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const theme = useTheme();
    isDark       = theme.isDark;
    toggleTheme  = theme.toggleTheme;
  } catch { /* silent fallback */ }

  /* ── State ── */
  const [showNotif,        setShowNotif]        = useState(false);
  const [notifications,    setNotifications]    = useState<Notification[]>([]);
  const [unread,           setUnread]           = useState(0);
  const [showSettingsAuth, setShowSettingsAuth] = useState(false);

  /* ── Scroll hide/show — identical to GuestShell ── */
  const mainRef         = useRef<HTMLDivElement>(null);
  const mobileHeaderRef = useRef<HTMLDivElement>(null);
  const lastScrollY     = useRef(0);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [mobileHeaderH, setMobileHeaderH] = useState(56);

  /* ────────────────────────────────────────────────────
     PATH-BASED LAYOUT RULES
  ──────────────────────────────────────────────────── */

  /* Full-screen on mobile: hide BOTH header AND bottom nav */
  const isFullScreen =
    pathname.startsWith("/create-post")  ||
    pathname.startsWith("/messages")     ||
    pathname.startsWith("/settings")     ||
    pathname.startsWith("/status")       ||
    pathname.startsWith("/report")       ||
    pathname === "/categories"           ||
    pathname.startsWith("/profile/edit");

  /* Header shows, bottom nav hides */
  const hideNavOnly =
    pathname === "/profile"                   ||
    pathname.startsWith("/user/")             ||
    pathname.startsWith("/profile/followers") ||
    pathname === "/feed/search";

  const showBottomNav  = !isFullScreen && !hideNavOnly;

  /* Promo panel: desktop only, /feed and /feed/search only */
  const showPromoPanel =
    pathname === "/feed" ||
    pathname === "/feed/search";

  /* ────────────────────────────────────────────────────
     EFFECTS
  ──────────────────────────────────────────────────── */

  useEffect(() => { injectThemeTransitionCSS(); }, []);

  /* Measure mobile header height */
  useEffect(() => {
    const measure = () => {
      setMobileHeaderH(mobileHeaderRef.current ? mobileHeaderRef.current.offsetHeight : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isFullScreen]);

  /* Scroll hide/show — same logic as GuestShell */
  useEffect(() => {
    const el = mainRef.current;
    if (!el || isFullScreen) return;
    const onScroll = () => {
      const cur   = el.scrollTop;
      const delta = cur - lastScrollY.current;
      if (Math.abs(delta) < 6) return;
      setHeaderVisible(cur < 40 || delta < 0);
      lastScrollY.current = cur;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [isFullScreen, pathname]);

  /* Reset header visible on route change */
  useEffect(() => {
    setHeaderVisible(true);
    lastScrollY.current = 0;
  }, [pathname]);

  /* Fetch notifications */
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("notifications")
      .select(`id, type, is_read, created_at, text, post_id,
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

  /* Mark read when panel opens */
  useEffect(() => {
    if (!showNotif || !user?.id || unread === 0) return;
    supabase.from("notifications").update({ is_read: true })
      .eq("user_id", user.id).eq("is_read", false)
      .then(() => setUnread(0));
  }, [showNotif]);

  /* Realtime — new notifications prepend instantly */
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notif_appshell:${user.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, payload => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
        setUnread(c => c + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  /* ────────────────────────────────────────────────────
     HANDLERS
  ──────────────────────────────────────────────────── */

  /* Home: scroll to top if already on /feed, else navigate */
  const handleHome = () => {
    if (pathname === "/feed") mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    else navigate("/feed");
  };

  /* Logout: hard replace — back button cannot return to logged-in state */
  const handleLogout = async () => {
    await signOut();
    sessionStorage.clear();
    window.location.replace("/");
  };

  const handleSettingsClick = () => {
    if (sessionStorage.getItem("sphere_settings_auth")) { navigate("/settings"); return; }
    setShowSettingsAuth(true);
  };

  const formatNotif = (n: Notification): string => {
    const who = n.actor?.name || "Someone";
    switch (n.type) {
      case "praise":       return `${who} praised your quote`;
      case "thought":      return `${who} replied to your quote`;
      case "follow":       return `${who} started following you`;
      case "forward":      return `${who} forwarded your quote`;
      case "mention":      return `${who} mentioned you`;
      case "story_view":   return `${who} viewed your story`;
      case "org_verified": return "Your organisation has been verified ✓";
      default:             return n.text || "New notification";
    }
  };

  const handleNotifTap = (n: Notification) => {
    setShowNotif(false);
    if (n.post_id) navigate(`/quote/${n.post_id}`);
    else if (n.type === "follow" && n.actor?.username) navigate(`/user/${n.actor.username}`);
  };

  const isActive = (path: string) =>
    path === "/feed"
      ? pathname === "/feed"
      : pathname === path || pathname.startsWith(path + "/");

  /* ────────────────────────────────────────────────────
     NAV ITEMS — desktop sidebar + mobile bottom bar
  ──────────────────────────────────────────────────── */
  const navItems = [
    { path: "/feed",        Icon: IcoHome,     label: "Home",         action: handleHome },
    { path: "/feed/search", Icon: IcoSearch,   label: "Search",       action: undefined  },
    { path: "/create-post", Icon: IcoCreate,   label: "Create Quote", action: undefined  },
    { path: "/messages",    Icon: IcoMessages, label: "Messages",     action: undefined  },
    { path: "/profile",     Icon: IcoProfile,  label: "Profile",      action: undefined  },
    { path: "/status",      Icon: IcoStatus,   label: "Status",       action: undefined  },
  ] as const;

  /* ══════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════ */
  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">

      {/* ═══ DESKTOP HEADER — always visible, same size as GuestShell ═══ */}
      <header className="hidden lg:flex items-center shrink-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-3 z-30 shadow-sm">
        <div className="flex-1">
          <button onClick={handleHome} className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm group-hover:bg-blue-700 transition-colors">
              <span className="text-white text-[17px] leading-none" style={{ fontFamily: "'Pacifico', cursive" }}>s</span>
            </div>
          </button>
        </div>
        <div className="flex-1 flex justify-center">
          <button onClick={handleHome}
            className="text-blue-600 dark:text-blue-400 text-2xl font-normal hover:opacity-80 transition-opacity"
            style={{ fontFamily: "'Pacifico', cursive" }}>
            sphere
          </button>
        </div>
        <div className="flex-1 flex items-center justify-end">
          <button onClick={() => setShowNotif(v => !v)}
            className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <IcoBell size={20} className="text-gray-600 dark:text-gray-300" />
            {unread > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold leading-none">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ═══ MOBILE HEADER — fixed, scroll hide/show, no category chips ═══ */}
      {!isFullScreen && (
        <div
          ref={mobileHeaderRef}
          className={`
            lg:hidden fixed top-0 left-0 right-0 z-30
            bg-white dark:bg-gray-900
            border-b border-gray-100 dark:border-gray-800 shadow-sm
            transition-transform duration-[350ms] ease-in-out
            ${headerVisible ? "translate-y-0" : "-translate-y-full"}
          `}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={handleHome}
              className="text-blue-600 dark:text-blue-400 text-xl font-normal leading-none shrink-0"
              style={{ fontFamily: "'Pacifico', cursive" }}>
              sphere
            </button>
            <div className="flex items-center gap-2">
              <button onClick={toggleTheme}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0">
                {isDark ? <IcoSun size={15} className="text-yellow-500" /> : <IcoMoon size={15} className="text-gray-500 dark:text-gray-400" />}
              </button>
              <button onClick={() => setShowNotif(v => !v)}
                className="relative w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0">
                <IcoBell size={16} className="text-gray-600 dark:text-gray-300" />
                {unread > 0 && (
                  <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full text-white text-[8px] flex items-center justify-center font-bold leading-none">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BODY ═══ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ═══ DESKTOP LEFT SIDEBAR ═══ */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 overflow-hidden">

          {/* ── Upper nav ── */}
          <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-0.5">
            {navItems.map(({ path, Icon, label, action }) => (
              <button key={path}
                onClick={action ?? (() => navigate(path))}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive(path)
                    ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                }`}>
                <Icon size={19} className={`shrink-0 ${isActive(path) ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                {label}
                {path === "/messages" && unread > 0 && (
                  <span className="ml-auto w-5 h-5 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold shrink-0">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
            ))}

            {/* Profile card */}
            {profile && (
              <>
                <div className="h-px bg-gray-100 dark:bg-gray-800 my-1" />
                <button onClick={() => navigate("/profile")}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left group">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                      <span className="text-white text-xs font-bold">{profile.name?.[0]?.toUpperCase() || "U"}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {profile.name}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">@{profile.username}</p>
                  </div>
                </button>
              </>
            )}
          </nav>

          {/* Divider */}
          <div className="mx-4 h-px bg-gray-100 dark:bg-gray-800 shrink-0" />

          {/* ── Lower utilities ── */}
          <div className="shrink-0 px-3 py-3 space-y-0.5">
            <button onClick={toggleTheme}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all">
              {isDark ? <IcoSun size={19} className="text-yellow-500 shrink-0" /> : <IcoMoon size={19} className="text-gray-400 shrink-0" />}
              {isDark ? "Light Mode" : "Dark Mode"}
            </button>
            <button
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all">
              <IcoHelp size={19} className="text-gray-400 dark:text-gray-500 shrink-0" />
              Help
            </button>
            <button onClick={handleSettingsClick}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                pathname.startsWith("/settings")
                  ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
              }`}>
              <IcoSettings size={19} className={`shrink-0 ${pathname.startsWith("/settings") ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
              Settings
            </button>
            <button onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 transition-all">
              <IcoLogout size={19} className="shrink-0" />
              Logout
            </button>
          </div>
        </aside>

        {/* ═══ MAIN CONTENT ═══
            paddingTop = mobileHeaderH so content sits below the fixed mobile header.
            On desktop the mobile header is display:none so offsetHeight = 0.
        ═══ */}
        <main
          ref={mainRef}
          className={`flex-1 min-w-0 overflow-y-auto bg-gray-50 dark:bg-gray-950 ${showBottomNav ? "pb-16 lg:pb-0" : "pb-0"}`}
          style={{ paddingTop: isFullScreen ? 0 : mobileHeaderH }}
        >
          {children}
        </main>

        {/* ═══ PROMOTION PANEL — desktop only, /feed and /feed/search only ═══ */}
        {showPromoPanel && (
          <aside className="hidden lg:flex flex-col w-64 shrink-0 overflow-y-auto border-l border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-3 py-4">
            <LoginPromotionPanel />
          </aside>
        )}
      </div>

      {/* ═══ MOBILE BOTTOM NAV — 5 items + FAB ═══ */}
      {!isFullScreen && showBottomNav && (
        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex items-center justify-around px-2 pt-1"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          <MobileNavBtn icon={IcoHome}     label="Home"     active={isActive("/feed")}        onClick={handleHome} />
          <MobileNavBtn icon={IcoSearch}   label="Search"   active={pathname === "/feed/search"} onClick={() => navigate("/feed/search")} />
          <button onClick={() => navigate("/create-post")}
            className="w-12 h-12 -mt-5 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30 hover:bg-blue-700 active:scale-95 transition-all shrink-0">
            <IcoCreate size={20} className="text-white" />
          </button>
          <MobileNavBtn icon={IcoMessages} label="Messages" active={isActive("/messages")}    onClick={() => navigate("/messages")} badge={unread > 0 ? unread : undefined} />
          <MobileNavBtn icon={IcoProfile}  label="Profile"  active={isActive("/profile")}     onClick={() => navigate("/profile")} />
        </div>
      )}

      {/* ═══ NOTIFICATION PANEL ═══ */}
      {showNotif && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setShowNotif(false)} />
          <div className="fixed top-14 right-4 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl w-80 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Notifications</h3>
              <button onClick={() => setShowNotif(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
            </div>
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                <IcoBell size={28} className="mx-auto mb-2 text-gray-200 dark:text-gray-700" />
                No notifications yet
              </div>
            ) : (
              notifications.map(n => (
                <button key={n.id} onClick={() => handleNotifTap(n)}
                  className={`flex items-center gap-3 w-full px-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors ${!n.is_read ? "bg-blue-50/60 dark:bg-blue-950/30" : ""}`}>
                  {n.actor?.avatar_url ? (
                    <img src={n.actor.avatar_url} alt={n.actor.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                      <IcoShield size={14} className="text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-800 dark:text-gray-200 leading-snug">{formatNotif(n)}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {new Date(n.created_at).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" })}
                    </p>
                  </div>
                  {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />}
                </button>
              ))
            )}
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

/* ═══════════════════ MOBILE NAV BUTTON ═══════════════════════════════════ */
function MobileNavBtn({ icon: Icon, label, active, onClick, badge }: {
  icon: React.FC<IconProps>; label: string; active: boolean;
  onClick: () => void; badge?: number;
}) {
  return (
    <button onClick={onClick}
      className={`relative flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors ${
        active ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
      }`}>
      {badge && badge > 0 && (
        <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full text-white text-[8px] flex items-center justify-center font-bold leading-none">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
      <Icon size={21} />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

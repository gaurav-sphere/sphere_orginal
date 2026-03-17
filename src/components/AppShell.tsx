import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  Home, Search, PenLine, MessageSquare, User,
  Bell, HelpCircle, Settings, LogOut, Shield,
  Moon, Sun, ChevronRight,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { supabase } from "../lib/supabase";
import { LoginPromotionPanel } from "./LoginPromotionPanel";

/* ══════════════════════════════════════════════════════════════
   VIEW TRANSITION CSS — injected once for circular dark mode
   Removes default cross-fade so our clip-path animation runs clean.
══════════════════════════════════════════════════════════════ */
let vtInjected = false;
function injectVtCss() {
  if (vtInjected || typeof document === "undefined") return;
  const s = document.createElement("style");
  s.textContent = `
    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation: none;
      mix-blend-mode: normal;
    }
  `;
  document.head.appendChild(s);
  vtInjected = true;
}

/* ══════════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════════ */
interface Notification {
  id:         string;
  type:       string;
  is_read:    boolean;
  created_at: string;
  text?:      string | null;
  post_id?:   string | null;
  actor: { name: string; username: string; avatar_url: string } | null;
}
interface AppShellProps { children: React.ReactNode }

/* ══════════════════════════════════════════════════════════════
   SETTINGS RE-AUTH MODAL
   Pure React state — NO sessionStorage.
   Resets every page refresh, so user is asked every time.
══════════════════════════════════════════════════════════════ */
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
    onSuccess(); // no sessionStorage — next refresh asks again
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

/* ══════════════════════════════════════════════════════════════
   APP SHELL
══════════════════════════════════════════════════════════════ */
export function AppShell({ children }: AppShellProps) {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const { user, profile, signOut } = useAuth();

  let isDark      = false;
  let toggleTheme = () => {};
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const theme = useTheme();
    isDark       = theme.isDark;
    toggleTheme  = theme.toggleTheme;
  } catch {}

  const [showNotif,        setShowNotif]        = useState(false);
  const [notifications,    setNotifications]    = useState<Notification[]>([]);
  const [unread,           setUnread]           = useState(0);
  const [settingsAuthed,   setSettingsAuthed]   = useState(false); // resets every page load
  const [showSettingsAuth, setShowSettingsAuth] = useState(false);

  const mainRef     = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const [headerVisible, setHeaderVisible] = useState(true);

  /* ────────────────────────────────────────────────────────
     LAYOUT RULES
  ──────────────────────────────────────────────────────── */

  // Mobile: hide both header + bottom nav
  const isFullScreen =
    pathname.startsWith("/create-post")  ||
    pathname.startsWith("/messages")     ||
    pathname.startsWith("/settings")     ||
    pathname.startsWith("/status")       ||
    pathname.startsWith("/report")       ||
    pathname === "/categories"           ||
    pathname.startsWith("/profile/edit");

  // Mobile: header shows, bottom nav hides
  const hideNavOnly =
    pathname === "/profile"                   ||
    pathname === "/notifications"             ||
    pathname.startsWith("/user/")             ||
    pathname.startsWith("/profile/followers") ||
    pathname === "/feed/search";

  const showBottomNav = !isFullScreen && !hideNavOnly;

  // Header never scroll-hides on these pages
  const headerAlwaysVisible =
    pathname === "/profile"        ||
    pathname === "/notifications";

  // Promo panel: desktop only on /feed and /feed/search
  const showPromoPanel =
    pathname === "/feed" ||
    pathname === "/feed/search";

  /* ────────────────────────────────────────────────────────
     EFFECTS
  ──────────────────────────────────────────────────────── */

  useEffect(() => { injectVtCss(); }, []);

  // Scroll detection — drives the mobile header max-height collapse
  useEffect(() => {
    const el = mainRef.current;
    if (!el || isFullScreen) return;
    const handler = () => {
      if (headerAlwaysVisible) { setHeaderVisible(true); return; }
      const cur   = el.scrollTop;
      const delta = cur - lastScrollY.current;
      if (Math.abs(delta) < 6) return;
      setHeaderVisible(cur < 40 || delta < 0);
      lastScrollY.current = cur;
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [pathname, isFullScreen, headerAlwaysVisible]);

  // Reset header visible on route change
  useEffect(() => {
    setHeaderVisible(true);
    lastScrollY.current = 0;
  }, [pathname]);

  // Fetch notifications
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

  // Mark read when panel opens
  useEffect(() => {
    if (!showNotif || !user?.id || unread === 0) return;
    supabase.from("notifications").update({ is_read: true })
      .eq("user_id", user.id).eq("is_read", false)
      .then(() => setUnread(0));
  }, [showNotif]);

  // Realtime new notifications
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`notif:${user.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, payload => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
        setUnread(c => c + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  /* ────────────────────────────────────────────────────────
     HANDLERS
  ──────────────────────────────────────────────────────── */

  const handleHome = () => {
    if (pathname === "/feed") mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    else navigate("/feed");
  };

  // Logout: window.location.replace prevents back-button returning to login state
  const handleLogout = async () => {
    await signOut();
    sessionStorage.clear();
    window.location.replace("/");
  };

  // Settings: ask every time (settingsAuthed = React state, not persisted)
  const handleSettingsClick = () => {
    if (settingsAuthed) { navigate("/settings"); return; }
    setShowSettingsAuth(true);
  };

  // Dark mode: circular reveal via View Transitions API, fallback to instant toggle
  const handleToggleTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
    const x  = e.clientX;
    const y  = e.clientY;
    const vt = (document as any).startViewTransition;
    if (!vt) { toggleTheme(); return; }
    const r = Math.hypot(
      Math.max(x, window.innerWidth  - x),
      Math.max(y, window.innerHeight - y),
    );
    vt(() => { toggleTheme(); }).ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: isDark
              ? [`circle(${r}px at ${x}px ${y}px)`, `circle(0px at ${x}px ${y}px)`]
              : [`circle(0px at ${x}px ${y}px)`,     `circle(${r}px at ${x}px ${y}px)`] },
          { duration: 500, easing: "ease-in-out",
            pseudoElement: "::view-transition-new(root)" },
        );
      }).catch(() => {});
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
    if (n.post_id)                                     navigate(`/quote/${n.post_id}`);
    else if (n.type === "follow" && n.actor?.username) navigate(`/user/${n.actor.username}`);
  };

  const isActive = (path: string) =>
    path === "/feed"
      ? pathname === "/feed"
      : pathname === path || pathname.startsWith(path + "/");

  /* ────────────────────────────────────────────────────────
     SIDEBAR NAV — Status removed, Notifications added
  ──────────────────────────────────────────────────────── */
  const navItems = [
    { path: "/feed",          Icon: Home,         label: "Home",          action: handleHome },
    { path: "/feed/search",   Icon: Search,       label: "Search",        action: undefined  },
    { path: "/create-post",   Icon: PenLine,      label: "Create Quote",  action: undefined  },
    { path: "/messages",      Icon: MessageSquare,label: "Messages",      action: undefined  },
    { path: "/profile",       Icon: User,         label: "Profile",       action: undefined  },
    { path: "/notifications", Icon: Bell,         label: "Notifications", action: undefined  },
  ] as const;

  /* ══════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════ */
  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">

      {/* ══ DESKTOP HEADER — always visible on lg+ ══ */}
      <header className="hidden lg:flex items-center shrink-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-3 z-30 shadow-sm">
        <div className="flex-1">
          <button onClick={handleHome} className="group">
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
            <Bell size={20} className="text-gray-600 dark:text-gray-300" />
            {unread > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold leading-none">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ══ MOBILE HEADER — in flex flow, max-height collapse for scroll hide/show.
          NOT fixed — no paddingTop issues, no white box gap between header and content.
          Collapses via max-height transition (350ms) when scrolling down.
          Profile page and notifications page: never hides (headerAlwaysVisible).
      ══ */}
      <div
        className="lg:hidden overflow-hidden shrink-0 bg-white dark:bg-gray-900"
        style={{
          maxHeight: (!isFullScreen && (headerVisible || headerAlwaysVisible)) ? "72px" : "0px",
          transition: "max-height 350ms ease-in-out",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 shadow-sm">
          <button onClick={handleHome}
            className="text-blue-600 dark:text-blue-400 text-xl font-normal leading-none shrink-0"
            style={{ fontFamily: "'Pacifico', cursive" }}>
            sphere
          </button>
          <div className="flex items-center gap-1.5">
            <button onClick={handleToggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0">
              {isDark ? <Sun size={15} className="text-yellow-500" /> : <Moon size={15} className="text-gray-500" />}
            </button>
            <button onClick={() => setShowNotif(v => !v)}
              className="relative w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0">
              <Bell size={16} className="text-gray-600 dark:text-gray-300" />
              {unread > 0 && (
                <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full text-white text-[8px] flex items-center justify-center font-bold leading-none">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ══ BODY ══ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ══ DESKTOP LEFT SIDEBAR ══ */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 overflow-hidden">

          {/* Upper nav */}
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
                <span className="flex-1 text-left">{label}</span>
                {path === "/notifications" && unread > 0 && (
                  <span className="w-5 h-5 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold shrink-0">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
            ))}

            {/* ── Profile card — styled like a nav item, not a separate card ── */}
            {profile && (
              <>
                <div className="h-px bg-gray-100 dark:bg-gray-800 my-1" />
                <button onClick={() => navigate("/profile")}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive("/profile")
                      ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                  }`}>
                  {/* Avatar — same size as icons (19px area) */}
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.name}
                      className="w-[19px] h-[19px] rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-[19px] h-[19px] rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                      <span className="text-white text-[8px] font-bold leading-none">{profile.name?.[0]?.toUpperCase() || "U"}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate leading-tight">{profile.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate leading-tight">@{profile.username}</p>
                  </div>
                </button>
              </>
            )}
          </nav>

          {/* Divider */}
          <div className="mx-4 h-px bg-gray-100 dark:bg-gray-800 shrink-0" />

          {/* Lower utilities */}
          <div className="shrink-0 px-3 py-3 space-y-0.5">
            <button onClick={handleToggleTheme}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all">
              {isDark ? <Sun size={19} className="text-yellow-500 shrink-0" /> : <Moon size={19} className="text-gray-400 shrink-0" />}
              {isDark ? "Light Mode" : "Dark Mode"}
            </button>
            <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all">
              <HelpCircle size={19} className="text-gray-400 dark:text-gray-500 shrink-0" />
              Help
            </button>
            <button onClick={handleSettingsClick}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                pathname.startsWith("/settings")
                  ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
              }`}>
              <Settings size={19} className={`shrink-0 ${pathname.startsWith("/settings") ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
              Settings
            </button>
            <button onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 transition-all">
              <LogOut size={19} className="shrink-0" />
              Logout
            </button>
          </div>
        </aside>

        {/* ══ MAIN CONTENT ══ */}
        <main
          ref={mainRef}
          className={`flex-1 min-w-0 overflow-y-auto bg-gray-50 dark:bg-gray-950 ${showBottomNav ? "pb-16 lg:pb-0" : "pb-0"}`}
        >
          {children}
        </main>

        {/* ══ PROMO PANEL — desktop, /feed + /feed/search only ══ */}
        {showPromoPanel && (
          <aside className="hidden lg:flex flex-col w-64 shrink-0 overflow-y-auto border-l border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-3 py-4">
            <LoginPromotionPanel />
          </aside>
        )}
      </div>

      {/* ══ MOBILE BOTTOM NAV ══ */}
      {!isFullScreen && showBottomNav && (
        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex items-center justify-around px-2 pt-1"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          <MobileBtn icon={Home}         label="Home"     active={isActive("/feed")}           onClick={handleHome} />
          <MobileBtn icon={Search}       label="Search"   active={pathname === "/feed/search"} onClick={() => navigate("/feed/search")} />
          <button onClick={() => navigate("/create-post")}
            className="w-12 h-12 -mt-5 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30 hover:bg-blue-700 active:scale-95 transition-all shrink-0">
            <PenLine size={20} className="text-white" />
          </button>
          <MobileBtn icon={MessageSquare} label="Messages" active={isActive("/messages")} onClick={() => navigate("/messages")} badge={unread > 0 ? unread : undefined} />
          <MobileBtn icon={User}          label="Profile"  active={isActive("/profile")}  onClick={() => navigate("/profile")} />
        </div>
      )}

      {/* ══ NOTIFICATION DROPDOWN PANEL ══ */}
      {showNotif && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setShowNotif(false)} />
          <div className="fixed top-14 right-4 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl w-80 max-h-[70vh] flex flex-col overflow-hidden">

            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Notifications</h3>
              <button onClick={() => setShowNotif(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
            </div>

            {/* Notification list */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  <Bell size={28} className="mx-auto mb-2 text-gray-200 dark:text-gray-700" />
                  No notifications yet
                </div>
              ) : (
                notifications.slice(0, 8).map(n => (
                  <button key={n.id} onClick={() => handleNotifTap(n)}
                    className={`flex items-center gap-3 w-full px-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors ${
                      !n.is_read ? "bg-blue-50/60 dark:bg-blue-950/30" : ""
                    }`}>
                    {n.actor?.avatar_url ? (
                      <img src={n.actor.avatar_url} alt={n.actor.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                        <Shield size={14} className="text-gray-400" />
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

            {/* View All — navigates to /notifications page */}
            <div className="shrink-0 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => { setShowNotif(false); navigate("/notifications"); }}
                className="flex items-center justify-center gap-1.5 w-full px-4 py-3 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">
                View all notifications
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══ SETTINGS RE-AUTH MODAL ══ */}
      {showSettingsAuth && (
        <SettingsAuthModal
          onSuccess={() => { setSettingsAuthed(true); setShowSettingsAuth(false); navigate("/settings"); }}
          onClose={() => setShowSettingsAuth(false)}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MOBILE NAV BUTTON
══════════════════════════════════════════════════════════════ */
function MobileBtn({ icon: Icon, label, active, onClick, badge }: {
  icon: React.ElementType; label: string; active: boolean;
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

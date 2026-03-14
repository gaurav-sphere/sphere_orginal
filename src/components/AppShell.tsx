import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  Home, Search, PenSquare, MessageCircle, User,
  Bell, HelpCircle, Settings, LogOut, X, Shield,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

interface AppShellProps {
  children: React.ReactNode;
}

interface Notification {
  id: string;
  type: string;
  is_read: boolean;
  created_at: string;
  text?: string | null;
  actor: { name: string; username: string; avatar_url: string } | null;
}

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();

  const [showNotif, setShowNotif]         = useState(false);
  const [showCreate, setShowCreate]       = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread]               = useState(0);

  /* ── Fetch real notifications from Supabase ── */
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("notifications")
      .select(`
        id, type, is_read, created_at, text,
        actor:profiles!notifications_actor_id_fkey (
          name, username, avatar_url
        )
      `)
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

  /* ── Mark all as read when panel opens ── */
  useEffect(() => {
    if (!showNotif || !user?.id || unread === 0) return;
    supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false)
      .then(() => setUnread(0));
  }, [showNotif, user?.id]);

  /* ── Format notification text ── */
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

  /* ── Logout ── */
  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  // Hide mobile bottom nav on these pages
  const hideBottomNav =
    pathname.startsWith("/create-post") ||
    pathname.startsWith("/feed/search") ||
    pathname.startsWith("/messages") ||
    pathname.startsWith("/thoughts/") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/");

  const isActive = (path: string) => {
    if (path === "/feed") return pathname === "/feed";
    return pathname === path || pathname.startsWith(path + "/");
  };

  const navItems = [
    { path: "/feed",         icon: Home,          label: "Home" },
    { path: "/feed/search",  icon: Search,        label: "Search" },
    { path: "/messages",     icon: MessageCircle, label: "Messages" },
    { path: "/profile",      icon: User,          label: "Profile" },
  ];

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Desktop Top Header */}
      <header className="hidden lg:flex items-center bg-white border-b border-gray-100 px-6 py-3 z-30 shadow-sm">
        {/* Left: Logo icon */}
        <div className="flex-1 flex items-center">
          <button
            onClick={() => navigate("/feed")}
            className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm hover:bg-blue-700 transition-colors"
          >
            <span className="text-white text-sm" style={{ fontFamily: "'Pacifico', cursive" }}>s</span>
          </button>
        </div>
        {/* Center: Site name */}
        <div className="flex-1 flex justify-center">
          <button
            onClick={() => navigate("/feed")}
            className="text-2xl text-blue-600 hover:opacity-80 transition-opacity"
            style={{ fontFamily: "'Pacifico', cursive" }}
          >
            sphere
          </button>
        </div>
        {/* Right: Notifications */}
        <div className="flex-1 flex items-center justify-end gap-2">
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <Bell size={20} className="text-gray-600" />
            {unread > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                {unread}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Left Sidebar */}
        <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-gray-100 overflow-y-auto flex-shrink-0">
          <nav className="flex-1 px-3 py-4 space-y-1">
            {/* Home + Search */}
            {navItems.slice(0, 2).map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive(item.path)
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <item.icon size={20} className={isActive(item.path) ? "text-blue-600" : "text-gray-500"} />
                {item.label}
              </button>
            ))}

            {/* Create Post */}
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all"
            >
              <PenSquare size={20} className="text-gray-500" />
              Create Post
            </button>

            {/* Messages + Profile */}
            {navItems.slice(2).map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive(item.path)
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <item.icon size={20} className={isActive(item.path) ? "text-blue-600" : "text-gray-500"} />
                {item.label}
              </button>
            ))}
          </nav>

          {/* Sidebar bottom utilities */}
          <div className="px-3 py-4 border-t border-gray-100 space-y-1">
            <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all">
              <HelpCircle size={18} />
              Help
            </button>
            <button
              onClick={() => navigate("/settings")}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all"
            >
              <Settings size={18} />
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-50 hover:text-red-600 transition-all"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          <div className="flex-1 overflow-y-auto lg:px-2">
            {children}
          </div>

          {/* Mobile Bottom Nav */}
          {!hideBottomNav && (
            <nav className="lg:hidden bg-white border-t border-gray-100 px-1 py-1 z-30 flex-shrink-0">
              <div className="flex items-center justify-around">
                <MobileNavBtn icon={Home}          label="Home"     active={isActive("/feed")}         onClick={() => navigate("/feed")} />
                <MobileNavBtn icon={Search}        label="Search"   active={isActive("/feed/search")}  onClick={() => navigate("/feed/search")} />
                {/* Create FAB */}
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-12 h-12 -mt-4 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-xl hover:scale-110 transition-transform active:scale-95"
                >
                  <PenSquare size={20} className="text-white" />
                </button>
                <MobileNavBtn icon={MessageCircle} label="Messages" active={isActive("/messages")}    onClick={() => navigate("/messages")} badge={unread > 0 ? unread : undefined} />
                <MobileNavBtn icon={User}          label="Profile"  active={isActive("/profile")}     onClick={() => navigate("/profile")} />
              </div>
            </nav>
          )}
        </main>
      </div>

      {/* Notification Panel */}
      {showNotif && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setShowNotif(false)} />
          <div className="fixed top-16 right-4 z-50 bg-white border border-gray-200 rounded-2xl shadow-2xl w-80 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800">Notifications</h3>
              <button onClick={() => setShowNotif(false)}>
                <X size={16} className="text-gray-400" />
              </button>
            </div>
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                <Bell size={28} className="mx-auto mb-2 text-gray-200" />
                No notifications yet
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 ${!notif.is_read ? "bg-blue-50" : ""}`}
                >
                  {notif.actor?.avatar_url ? (
                    <img src={notif.actor.avatar_url} alt={notif.actor.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <Shield size={14} className="text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-800 leading-snug">{formatNotif(notif)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(notif.created_at).toLocaleString("en-IN", {
                        hour: "numeric", minute: "2-digit", day: "numeric", month: "short",
                      })}
                    </p>
                  </div>
                  {!notif.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Create Post Options Dialog */}
      {showCreate && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowCreate(false)} />
          <div className="fixed bottom-24 lg:bottom-auto lg:left-64 lg:top-1/2 lg:-translate-y-1/2 left-1/2 -translate-x-1/2 lg:translate-x-4 z-50 bg-white rounded-3xl shadow-2xl w-72 overflow-hidden border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800">What kind of post?</h3>
              <p className="text-xs text-gray-400 mt-0.5">Choose how you want to share</p>
            </div>
            <button
              className="flex items-center gap-4 w-full px-5 py-4 hover:bg-gray-50 transition-colors"
              onClick={() => { setShowCreate(false); navigate("/create-post"); }}
            >
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <PenSquare size={18} className="text-blue-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-800">Create Post</p>
                <p className="text-xs text-gray-400">Post as yourself</p>
              </div>
            </button>
            <div className="h-px bg-gray-50" />
            <button
              className="flex items-center gap-4 w-full px-5 py-4 hover:bg-gray-50 transition-colors"
              onClick={() => { setShowCreate(false); navigate("/create-post?mode=anon"); }}
            >
              <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center">
                <Shield size={18} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-800">Anonymous Post</p>
                <p className="text-xs text-gray-400">Hide your identity</p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MobileNavBtn({
  icon: Icon, label, active, onClick, badge
}: {
  icon: any; label: string; active: boolean; onClick: () => void; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors relative ${
        active ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
      }`}
    >
      {badge && badge > 0 && (
        <span className="absolute top-0 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[8px] flex items-center justify-center font-bold">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
      <Icon size={22} className={active ? "text-blue-600" : ""} />
      <span className={`text-[10px] font-medium ${active ? "text-blue-600" : ""}`}>{label}</span>
    </button>
  );
}

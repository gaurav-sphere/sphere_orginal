import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  Home, Search, PenSquare, MessageCircle, User, Bell,
  HelpCircle, Settings, LogOut, X, BarChart2,
  Building2, Users, Pin,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

interface AppShellProps {
  children: React.ReactNode;
  isOrg?: boolean;
}

interface Notification {
  id: string;
  type: string;
  is_read: boolean;
  created_at: string;
  text?: string;
  actor?: { name: string; username: string; avatar_url: string } | null;
}

interface SuggestedUser {
  id: string;
  name: string;
  username: string;
  avatar_url: string;
  is_verified: boolean;
}

interface TrendingTag {
  tag: string;
  posts_count: number;
}

export function AppShell({ children, isOrg = false }: AppShellProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, profile, signOut } = useAuth();

  const [showNotif, setShowNotif]         = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread]               = useState(0);
  const [trending, setTrending]           = useState<TrendingTag[]>([]);
  const [suggested, setSuggested]         = useState<SuggestedUser[]>([]);

  /* ── Fetch notifications ── */
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
      .limit(20)
      .then(({ data }) => {
        if (data) {
          setNotifications(data as unknown as Notification[]);
          setUnread(data.filter((n: { is_read: boolean }) => !n.is_read).length);
        }
      });
  }, [user?.id]);

  /* ── Fetch trending hashtags ── */
  useEffect(() => {
    supabase
      .rpc("get_trending_hashtags", { limit_n: 5 })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setTrending(data);
        }
        // No fallback — show nothing if no real data
      });
  }, []);

  /* ── Fetch suggested users (people you don't follow yet) ── */
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("id, name, username, avatar_url, is_verified")
      .neq("id", user.id)
      .eq("is_org", false)
      .limit(3)
      .then(({ data }) => {
        if (data) setSuggested(data as SuggestedUser[]);
      });
  }, [user?.id]);

  /* ── Mark notifications as read when panel opens ── */
  useEffect(() => {
    if (!showNotif || !user?.id || unread === 0) return;
    supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false)
      .then(() => setUnread(0));
  }, [showNotif, user?.id]);

  const isActive = (p: string) =>
    p === "/feed" ? pathname === "/feed" : pathname === p || pathname.startsWith(p + "/");

  const personalNav = [
    { path: "/feed",        icon: Home,         label: "Home" },
    { path: "/feed/search", icon: Search,        label: "Search" },
    { path: "/create-post", icon: PenSquare,     label: "Create Quote" },
    { path: "/messages",    icon: MessageCircle, label: "Messages" },
    { path: "/profile",     icon: User,          label: "Profile" },
  ];

  const orgNav = [
    { path: "/feed",          icon: Home,         label: "Home Feed" },
    { path: "/org/analytics", icon: BarChart2,    label: "Analytics" },
    { path: "/create-post",   icon: PenSquare,    label: "Create Quote" },
    { path: "/messages",      icon: MessageCircle,label: "Inbox" },
    { path: "/org/profile",   icon: Building2,    label: "My Organisation" },
    { path: "/org/audience",  icon: Users,        label: "Audience" },
    { path: "/settings",      icon: Settings,     label: "Org Settings" },
  ];

  const navItems   = isOrg ? orgNav : personalNav;
  const mobileItems = isOrg
    ? [orgNav[0], orgNav[2], orgNav[3], orgNav[4]]
    : [personalNav[0], personalNav[1], personalNav[3], personalNav[4]];

  const hideBottom = ["/create-post", "/messages", "/thoughts/", "/status/"].some(
    (p) => pathname.startsWith(p)
  ) || pathname === "/status";

  const accentClass = isOrg ? "bg-gray-900 text-white" : "bg-blue-600 text-white";

  const formatNotif = (n: Notification) => {
    const actor = n.actor;
    const who   = actor?.name || "Someone";
    switch (n.type) {
      case "praise":   return `${who} praised your quote`;
      case "thought":  return `${who} replied to your quote`;
      case "follow":   return `${who} started following you`;
      case "forward":  return `${who} forwarded your quote`;
      case "mention":  return `${who} mentioned you`;
      default:         return n.text || "New notification";
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">

      {/* ── Desktop Top Header ── */}
      <header className="hidden lg:flex items-center bg-white border-b border-gray-100 px-6 py-3 z-30 shadow-sm shrink-0">
        <div className="flex-1 flex items-center">
          <button onClick={() => navigate("/feed")}
            className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm transition-opacity hover:opacity-80 ${accentClass}`}>
            <span className="font-sphere text-sm">s</span>
          </button>
        </div>
        <div className="flex-1 flex justify-center">
          <button onClick={() => navigate("/feed")}
            className={`font-sphere text-2xl transition-opacity hover:opacity-80 ${isOrg ? "text-gray-900" : "text-blue-600"}`}>
            sphere
          </button>
        </div>
        <div className="flex-1 flex items-center justify-end">
          <button onClick={() => setShowNotif(!showNotif)}
            className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <Bell size={20} className="text-gray-600" />
            {unread > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                {unread}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── Notification Panel ── */}
      {showNotif && (
        <div className="fixed inset-0 z-50 flex items-start justify-end pt-16 pr-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-80 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">Notifications</h3>
              <button onClick={() => setShowNotif(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                <Bell size={28} className="mx-auto mb-2 text-gray-200" />
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id}
                  className={`px-4 py-3 border-b border-gray-50 flex gap-3 ${!n.is_read ? "bg-blue-50/40" : ""}`}>
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">{formatNotif(n)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(n.created_at).toLocaleString("en-IN", {
                        hour: "numeric", minute: "2-digit", day: "numeric", month: "short"
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="fixed inset-0 -z-10" onClick={() => setShowNotif(false)} />
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* ── Desktop Left Sidebar ── */}
        <aside className={`hidden lg:flex flex-col w-60 border-r overflow-y-auto shrink-0 ${isOrg ? "bg-gray-950 border-gray-800" : "bg-white border-gray-100"}`}>
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <button key={item.path} onClick={() => navigate(item.path)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isOrg
                      ? active ? "bg-gray-800 text-white" : "text-gray-400 hover:bg-gray-900 hover:text-gray-200"
                      : active ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}>
                  <item.icon size={20} className={active ? (isOrg ? "text-white" : "text-blue-600") : ""} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Sidebar user mini-profile */}
          {profile && (
            <div className={`mx-3 mb-2 p-3 rounded-xl ${isOrg ? "bg-gray-900" : "bg-gray-50"}`}>
              <div className="flex items-center gap-2">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.name}
                    className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 text-white font-bold text-sm">
                    {profile.name?.[0]?.toUpperCase() || "U"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold truncate ${isOrg ? "text-white" : "text-gray-900"}`}>
                    {profile.name}
                  </p>
                  <p className={`text-xs truncate ${isOrg ? "text-gray-400" : "text-gray-500"}`}>
                    @{profile.username}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className={`px-3 py-4 border-t ${isOrg ? "border-gray-800" : "border-gray-100"} space-y-0.5`}>
            {!isOrg && (
              <button onClick={() => navigate("/settings")}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-all font-medium">
                <HelpCircle size={18} />Help & Support
              </button>
            )}
            <button onClick={() => navigate("/settings")}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isOrg ? "text-gray-400 hover:bg-gray-900 hover:text-gray-200" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}>
              <Settings size={18} />Settings
            </button>
            <button onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-all">
              <LogOut size={18} />Logout
            </button>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-y-auto">
          <div className={`mx-auto max-w-2xl w-full ${hideBottom ? "" : "pb-20 lg:pb-4"}`}>
            {children}
          </div>
        </main>

        {/* ── Desktop Right Panel ── */}
        <aside className="hidden xl:flex flex-col w-72 shrink-0 overflow-y-auto border-l border-gray-100 bg-gray-50 px-4 py-4 gap-4">
          {/* Trending — only shown when real data exists */}
          {trending.length > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm mb-3">🔥 Trending</h3>
              {trending.map((t, i) => (
                <button key={t.tag}
                  onClick={() => navigate(`/feed/search?q=${t.tag}`)}
                  className="flex items-center justify-between w-full py-2 hover:bg-gray-50 rounded-lg px-1 transition-colors group">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                    <span className="text-sm font-semibold text-blue-600 group-hover:text-blue-700">
                      #{t.tag}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{t.posts_count} posts</span>
                </button>
              ))}
            </div>
          )}

          {/* Suggested users — only shown when real data exists */}
          {suggested.length > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm mb-3">People to follow</h3>
              {suggested.map((u) => (
                <div key={u.id} className="flex items-center gap-3 py-2">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt={u.name}
                      className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                      {u.name?.[0]?.toUpperCase() || "U"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{u.name}</p>
                      {u.is_verified && <span className="text-blue-500 text-xs">✓</span>}
                    </div>
                    <p className="text-xs text-gray-500">@{u.username}</p>
                  </div>
                  <button
                    onClick={() => navigate(`/user/${u.id}`)}
                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full font-semibold hover:bg-blue-700 transition-colors">
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* ── Mobile Bottom Nav ── */}
      {!hideBottom && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 safe-area-inset-bottom">
          <div className="flex items-center justify-around px-2 py-1 max-w-lg mx-auto">
            {mobileItems.map((item, idx) => {
              const active = isActive(item.path);
              if (!isOrg && idx === 1) {
                return (
                  <React.Fragment key="create-fab">
                    <button onClick={() => navigate(item.path)}
                      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${active ? "text-blue-600" : "text-gray-500"}`}>
                      <item.icon size={22} className={active ? "text-blue-600" : ""} />
                      <span className="text-[10px] font-medium">{item.label}</span>
                    </button>
                    <button onClick={() => navigate("/create-post")}
                      className="flex flex-col items-center justify-center -mt-5 w-14 h-14 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30 hover:bg-blue-700 active:scale-95 transition-all">
                      <PenSquare size={22} className="text-white" />
                    </button>
                  </React.Fragment>
                );
              }
              return (
                <button key={item.path} onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${active ? "text-blue-600" : "text-gray-500"}`}>
                  <div className="relative">
                    <item.icon size={22} className={active ? "text-blue-600" : ""} />
                    {item.path === "/messages" && unread > 0 && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">
                        {unread}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* ── Mobile Top Header ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-100 px-4 py-2 flex items-center justify-between shadow-sm" style={{ order: -1 }}>
        <div className="w-8" />
        <span className={`font-sphere text-xl ${isOrg ? "text-gray-900" : "text-blue-600"}`}>sphere</span>
        <button onClick={() => setShowNotif(!showNotif)}
          className="relative w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
          <Bell size={18} className="text-gray-600" />
          {unread > 0 && (
            <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">
              {unread}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

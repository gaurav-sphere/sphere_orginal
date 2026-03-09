import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  Home, Search, PenSquare, MessageCircle, User, Bell,
  HelpCircle, Settings, LogOut, X, BarChart2,
  Building2, Users, Pin, Shield,
} from "lucide-react";
import { mockNotifications } from "../mockData";

interface AppShellProps {
  children: React.ReactNode;
  isOrg?: boolean;
}

export function AppShell({ children, isOrg = false }: AppShellProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [showNotif, setShowNotif] = useState(false);
  const unread = mockNotifications.filter((n) => !n.read).length;

  const isActive = (p: string) =>
    p === "/feed" ? pathname === "/feed" : pathname === p || pathname.startsWith(p + "/");

  const personalNav = [
    { path: "/feed",         icon: Home,         label: "Home" },
    { path: "/feed/search",  icon: Search,        label: "Search" },
    { path: "/create-post",  icon: PenSquare,     label: "Create Quote" },
    { path: "/messages",     icon: MessageCircle, label: "Messages" },
    { path: "/profile",      icon: User,          label: "Profile" },
  ];

  const orgNav = [
    { path: "/feed",           icon: Home,         label: "Home Feed" },
    { path: "/org/analytics",  icon: BarChart2,    label: "Analytics" },
    { path: "/create-post",    icon: PenSquare,    label: "Create Quote" },
    { path: "/messages",       icon: MessageCircle,label: "Inbox" },
    { path: "/org/profile",    icon: Building2,    label: "My Organisation" },
    { path: "/org/audience",   icon: Users,        label: "Audience" },
    { path: "/org/pinned",     icon: Pin,          label: "Pinned Content" },
    { path: "/settings",       icon: Settings,     label: "Org Settings" },
  ];

  const navItems = isOrg ? orgNav : personalNav;
  const mobileItems = isOrg
    ? [orgNav[0], orgNav[2], orgNav[3], orgNav[4]]
    : [personalNav[0], personalNav[1], personalNav[3], personalNav[4]];

  /* hide bottom bar on full-screen pages */
  const hideBottom = ["/create-post", "/messages", "/thoughts/", "/status/"].some(
    (p) => pathname.startsWith(p)
  ) || pathname === "/status";

  const accentClass = isOrg
    ? "bg-gray-900 text-white"
    : "bg-blue-600 text-white";

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">

      {/* ── Desktop Top Header ───────────────────────────────── */}
      <header className="hidden lg:flex items-center bg-white border-b border-gray-100 px-6 py-3 z-30 shadow-sm shrink-0">
        {/* Logo */}
        <div className="flex-1 flex items-center">
          <button
            onClick={() => navigate("/feed")}
            className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm transition-opacity hover:opacity-80 ${accentClass}`}
          >
            <span className="font-sphere text-sm">s</span>
          </button>
        </div>
        {/* Wordmark */}
        <div className="flex-1 flex justify-center">
          <button
            onClick={() => navigate("/feed")}
            className={`font-sphere text-2xl transition-opacity hover:opacity-80 ${isOrg ? "text-gray-900" : "text-blue-600"}`}
          >
            sphere
          </button>
        </div>
        {/* Bell */}
        <div className="flex-1 flex items-center justify-end">
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

      {/* ── Notification panel ──────────────────────────────── */}
      {showNotif && (
        <div className="fixed inset-0 z-50 flex items-start justify-end pt-16 pr-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-80 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">Notifications</h3>
              <button onClick={() => setShowNotif(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            {mockNotifications.map((n) => (
              <div key={n.id} className={`px-4 py-3 border-b border-gray-50 flex gap-3 ${!n.read ? "bg-blue-50/40" : ""}`}>
                {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">{n.user?.name}</span> {n.content}
                  <span className="text-xs text-gray-400 ml-2">{n.time}</span>
                </p>
              </div>
            ))}
          </div>
          <div className="fixed inset-0 -z-10" onClick={() => setShowNotif(false)} />
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* ── Desktop Left Sidebar ──────────────────────────── */}
        <aside className={`hidden lg:flex flex-col w-60 border-r overflow-y-auto shrink-0 ${isOrg ? "bg-gray-950 border-gray-800" : "bg-white border-gray-100"}`}>
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isOrg
                      ? active
                        ? "bg-gray-800 text-white"
                        : "text-gray-400 hover:bg-gray-900 hover:text-gray-200"
                      : active
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <item.icon size={20} className={active ? (isOrg ? "text-white" : "text-blue-600") : ""} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Bottom actions */}
          <div className={`px-3 py-4 border-t ${isOrg ? "border-gray-800" : "border-gray-100"} space-y-0.5`}>
            {!isOrg && (
              <button
                onClick={() => navigate("/settings")}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-all font-medium"
              >
                <HelpCircle size={18} />Help & Support
              </button>
            )}
            <button
              onClick={() => navigate("/settings")}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isOrg ? "text-gray-400 hover:bg-gray-900 hover:text-gray-200" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}
            >
              <Settings size={18} />Settings
            </button>
            <button
              onClick={() => navigate("/login")}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-all"
            >
              <LogOut size={18} />Logout
            </button>
          </div>
        </aside>

        {/* ── Main content ──────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className={`mx-auto max-w-2xl w-full ${hideBottom ? "" : "pb-20 lg:pb-4"}`}>
            {children}
          </div>
        </main>

        {/* ── Desktop Right Panel ───────────────────────────── */}
        <aside className="hidden xl:flex flex-col w-72 shrink-0 overflow-y-auto border-l border-gray-100 bg-gray-50 px-4 py-4 gap-4">
          {/* Trending widget */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm mb-3">🔥 Trending in India</h3>
            {["#INDvsAUS","#ISRO","#MumbaiRains","#StartupIndia","#ARRahman"].map((tag, i) => (
              <button key={tag} onClick={() => navigate(`/feed/search?q=${tag}`)}
                className="flex items-center justify-between w-full py-2 hover:bg-gray-50 rounded-lg px-1 transition-colors group">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-4">{i+1}</span>
                  <span className="text-sm font-semibold text-blue-600 group-hover:text-blue-700">{tag}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {["124K","67K","54K","41K","48K"][i]} posts
                </span>
              </button>
            ))}
          </div>

          {/* Suggested users */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm mb-3">People to follow</h3>
            {[
              { name:"Priya Sharma", handle:"@priya_s", verified:true, avatar:"https://images.unsplash.com/photo-1753288695169-e51f5a3ff24f?w=60&h=60&fit=crop" },
              { name:"Dev Kumar",    handle:"@dev_k",   verified:false, avatar:"https://images.unsplash.com/photo-1639149888905-fb39731f2e6c?w=60&h=60&fit=crop&brightness=90" },
            ].map((u) => (
              <div key={u.handle} className="flex items-center gap-3 py-2">
                <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{u.name}</p>
                    {u.verified && <span className="text-blue-500 text-xs">✓</span>}
                  </div>
                  <p className="text-xs text-gray-500">{u.handle}</p>
                </div>
                <button className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full font-semibold hover:bg-blue-700 transition-colors">
                  Follow
                </button>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* ── Mobile Bottom Nav ─────────────────────────────── */}
      {!hideBottom && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 safe-area-inset-bottom">
          <div className="flex items-center justify-around px-2 py-1 max-w-lg mx-auto">
            {mobileItems.map((item, idx) => {
              const active = isActive(item.path);
              /* Create FAB in center */
              if (!isOrg && idx === 1) {
                return (
                  <React.Fragment key="create-fab">
                    <button
                      onClick={() => navigate(item.path)}
                      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${active ? "text-blue-600" : "text-gray-500"}`}
                    >
                      <item.icon size={22} className={active ? "text-blue-600" : ""} />
                      <span className="text-[10px] font-medium">{item.label}</span>
                    </button>
                    {/* FAB */}
                    <button
                      onClick={() => navigate("/create-post")}
                      className="flex flex-col items-center justify-center -mt-5 w-14 h-14 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30 hover:bg-blue-700 active:scale-95 transition-all"
                    >
                      <PenSquare size={22} className="text-white" />
                    </button>
                  </React.Fragment>
                );
              }
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${active ? "text-blue-600" : "text-gray-500"}`}
                >
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

      {/* ── Mobile Top Header ─────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-100 px-4 py-2 flex items-center justify-between shadow-sm" style={{order:-1}}>
        <div className="w-8" />
        <span className={`font-sphere text-xl ${isOrg ? "text-gray-900" : "text-blue-600"}`}>sphere</span>
        <button
          onClick={() => setShowNotif(!showNotif)}
          className="relative w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
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

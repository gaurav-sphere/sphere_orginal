import React from "react";
import { useNavigate } from "react-router";
import {
  Search, LogIn, Flame, Building2, FlaskConical, Music2, Globe,
} from "lucide-react";

const SIDEBAR_CATS = [
  { id: "top", label: "Top", icon: Flame },
  { id: "city", label: "City", icon: Building2 },
  { id: "sports", label: "Sports", emoji: "🏏" },
  { id: "science", label: "Science & Tech", icon: FlaskConical },
  { id: "entertainment", label: "Entertainment", icon: Music2 },
  { id: "world", label: "World", icon: Globe },
];

/**
 * Wrapper for detail pages (e.g. ThoughtsPage) when the user is a guest.
 * – Desktop: shows the same guest categories sidebar as the home feed.
 * – Mobile: clean full-screen container with no navigation chrome.
 */
export function GuestPostShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Desktop header — matches GuestShell header */}
      <header className="hidden lg:flex items-center bg-white border-b border-gray-100 px-6 py-3 z-30 shadow-sm">
        <div className="flex-1 flex items-center">
          <button
            onClick={() => navigate("/")}
            className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm hover:bg-blue-700 transition-colors"
          >
            <span className="text-white text-sm" style={{ fontFamily: "'Pacifico', cursive" }}>s</span>
          </button>
        </div>
        <div className="flex-1 flex justify-center">
          <button onClick={() => navigate("/")} className="text-2xl text-blue-600" style={{ fontFamily: "'Pacifico', cursive" }}>
            sphere
          </button>
        </div>
        <div className="flex-1 flex items-center justify-end gap-3">
          <button onClick={() => navigate("/search")} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <Search size={18} className="text-gray-600" />
          </button>
          <button
            onClick={() => navigate("/login")}
            className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            Login / Register
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop left sidebar — same guest categories as home feed */}
        <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-gray-100 flex-shrink-0">
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2">Categories</p>
            {SIDEBAR_CATS.map((cat) => (
              <button
                key={cat.id}
                onClick={() => navigate("/")}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all"
              >
                {"emoji" in cat
                  ? <span className="text-base">{cat.emoji}</span>
                  : <cat.icon size={18} className="text-gray-500" />}
                {cat.label}
              </button>
            ))}
          </nav>
          <div className="px-3 py-4 border-t border-gray-100">
            <button
              onClick={() => navigate("/login")}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-blue-600 hover:bg-blue-50 transition-all font-medium"
            >
              <LogIn size={17} />
              Login / Register
            </button>
          </div>
        </aside>

        {/* Main content — mobile is pure full-screen, no nav chrome */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Search, MapPin, Flame, Building2, Globe, Tv2, FlaskConical, Trophy, X } from "lucide-react";

const CATS = [
  { id: "top",           label: "Top",           icon: "🔥" },
  { id: "city",          label: "City",           icon: "🏙️" },
  { id: "sports",        label: "Sports",         icon: "🏏" },
  { id: "science",       label: "Science & Tech", icon: "🔬" },
  { id: "entertainment", label: "Entertainment",  icon: "🎬" },
  { id: "world",         label: "World",          icon: "🌍" },
];

interface GuestShellProps {
  children: React.ReactNode;
  activeCategory?: string;
  onCategoryChange?: (id: string) => void;
  location?: { city: string; country: string } | null;
}

export function GuestShell({ children, activeCategory = "top", onCategoryChange, location }: GuestShellProps) {
  const navigate = useNavigate();
  const change = onCategoryChange ?? (() => {});

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* ── Desktop Header ── */}
      <header className="hidden lg:flex items-center bg-white border-b border-gray-100 px-6 py-3 z-30 shadow-sm shrink-0">
        <div className="flex-1 flex items-center">
          <button onClick={() => navigate("/")} className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm hover:opacity-80 transition-opacity">
            <span className="font-sphere text-white text-sm">s</span>
          </button>
        </div>
        <div className="flex-1 flex justify-center">
          <button onClick={() => navigate("/")} className="font-sphere text-2xl text-blue-600 hover:opacity-80 transition-opacity">sphere</button>
        </div>
        <div className="flex-1 flex items-center justify-end gap-3">
          {location?.city && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin size={11} className="text-blue-400" />
              <span>{location.city}</span>
            </div>
          )}
          <button onClick={() => navigate("/search")} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <Search size={18} className="text-gray-600" />
          </button>
          <button
            onClick={() => navigate("/login")}
            className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
          >
            Login / Register
          </button>
        </div>
      </header>

      {/* ── Mobile Top Bar ── */}
      <div className="lg:hidden bg-white border-b border-gray-100 shadow-sm shrink-0">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="w-8" />
          <span className="font-sphere text-xl text-blue-600">sphere</span>
          <button onClick={() => navigate("/search")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
            <Search size={18} className="text-gray-600" />
          </button>
        </div>
        {/* Mobile category chips */}
        <div className="flex gap-2 px-3 pb-2.5 overflow-x-auto scrollbar-hide">
          {CATS.map((c) => (
            <button
              key={c.id}
              onClick={() => change(c.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all ${
                activeCategory === c.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span>{c.icon}</span>{c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Desktop Sidebar ── */}
        <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-gray-100 shrink-0">
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-3">Categories</p>
            {CATS.map((c) => (
              <button
                key={c.id}
                onClick={() => change(c.id)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeCategory === c.id
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className="text-base">{c.icon}</span>{c.label}
              </button>
            ))}
          </nav>
          <div className="px-3 py-4 border-t border-gray-100 space-y-2">
            <button
              onClick={() => navigate("/login")}
              className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
            >
              Login / Register
            </button>
          </div>
        </aside>

        {/* ── Content ── */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto w-full pb-6">
            {children}
          </div>
        </main>

        {/* ── Right panel ── */}
        <aside className="hidden xl:flex flex-col w-72 shrink-0 overflow-y-auto border-l border-gray-100 bg-gray-50 px-4 py-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm mb-3">🔥 Trending in India</h3>
            {["#INDvsAUS","#ISRO","#MumbaiRains","#StartupIndia","#ARRahman"].map((tag, i) => (
              <button key={tag} onClick={() => navigate(`/search?q=${tag}`)}
                className="flex items-center justify-between w-full py-2 hover:bg-gray-50 rounded-lg px-1 transition-colors group">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-4">{i+1}</span>
                  <span className="text-sm font-semibold text-blue-600 group-hover:text-blue-700">{tag}</span>
                </div>
                <span className="text-xs text-gray-400">{["124K","67K","54K","41K","48K"][i]} posts</span>
              </button>
            ))}
          </div>
          <div className="bg-blue-600 rounded-2xl p-5 text-white text-center">
            <p className="font-sphere text-2xl mb-1">sphere</p>
            <p className="text-sm font-semibold mb-1">Your world. Your voice.</p>
            <p className="text-xs text-blue-200 mb-4">Join millions sharing thoughts across India</p>
            <button onClick={() => navigate("/login")} className="w-full py-2 bg-white text-blue-700 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors">
              Join for free →
            </button>
          </div>
        </aside>
      </div>

      {/* ── Mobile Login bar at bottom ── */}
      <div className="lg:hidden bg-white border-t border-gray-100 px-4 py-2.5 flex items-center gap-3 shrink-0">
        <p className="flex-1 text-sm text-gray-600 font-medium">Join Sphere — it's free</p>
        <button onClick={() => navigate("/login")} className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-bold hover:bg-blue-700 transition-colors">
          Sign up
        </button>
      </div>
    </div>
  );
}
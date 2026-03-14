import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useGuest } from "../contexts/GuestContext";
import { useTheme } from "../contexts/ThemeContext";

/* ═══════════════════ PHOSPHOR-STYLE ICONS (same style as AppShell) ═════════ */
type IconProps = { size?: number; className?: string };
const ic = (d: string) => ({ size=20, className="" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d}/>
  </svg>
);

const IcoHome    = ic("M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5zM9 21V12h6v9");
const IcoSearch  = ic("M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35");
const IcoFire    = ic("M12 2C6 8 4 12 6.5 15.5c1 1.5 2.5 2.5 5 2.5h1c2.5 0 4.5-1.5 5-4 .5-2.5-1-5-2.5-7-1 2-2.5 3-2.5 3S13 9 12 2z");
const IcoBuildings = ({ size=20, className="" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="7" width="10" height="14" rx="1"/><rect x="13" y="3" width="8" height="18" rx="1"/>
    <line x1="7" y1="11" x2="7" y2="11"/><line x1="7" y1="14" x2="7" y2="14"/><line x1="17" y1="7" x2="17" y2="7"/>
    <line x1="17" y1="11" x2="17" y2="11"/><line x1="17" y1="15" x2="17" y2="15"/>
  </svg>
);
const IcoTrophy  = ic("M8 21h8M12 17v4M6 3H3v4a6 6 0 006 6h6a6 6 0 006-6V3h-3M6 3h12");
const IcoFlask   = ic("M9 3h6M9 3v5l-5 9a1 1 0 00.9 1.5h14.2A1 1 0 0020 17l-5-9V3");
const IcoTV      = ic("M21 7H3a1 1 0 00-1 1v10a1 1 0 001 1h18a1 1 0 001-1V8a1 1 0 00-1-1zM8 21h8M12 17v4");
const IcoFlag    = ic("M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7");
const IcoGlobe   = ({ size=20, className="" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
  </svg>
);
const IcoNational = ic("M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5");
const IcoHelp    = ic("M12 22a10 10 0 110-20 10 10 0 010 20zM9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01");
const IcoMoon    = ic("M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z");
const IcoSun     = ({ size=20, className="" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);
const IcoMapPin  = ic("M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z M12 10a2 2 0 100-4 2 2 0 000 4z");

/* ═══════════════════════ CATEGORIES ════════════════════════════════════════ */
const CATS = [
  { id: "top",           label: "Top",            Icon: IcoFire      },
  { id: "city",          label: "City",           Icon: IcoBuildings },
  { id: "sports",        label: "Sports",         Icon: IcoTrophy    },
  { id: "science",       label: "Science & Tech", Icon: IcoFlask     },
  { id: "entertainment", label: "Entertainment",  Icon: IcoTV        },
  { id: "national",      label: "National",       Icon: IcoNational  },
  { id: "world",         label: "World",          Icon: IcoGlobe     },
];

interface GuestShellProps {
  children: React.ReactNode;
  activeCategory?: string;
  onCategoryChange?: (id: string) => void;
}

export function GuestShell({ children, activeCategory = "top", onCategoryChange }: GuestShellProps) {
  const navigate = useNavigate();
  const { location, setLocation, trackEvent } = useGuest() as any;
  const { isDark, toggleTheme } = useTheme();

  const [ipLocation, setIpLocation] = useState<{ city: string; country: string } | null>(
    location ? { city: location.city, country: location.country } : null
  );

  /* ── IP-based auto location (no permission needed) ── */
  useEffect(() => {
    if (ipLocation) return;
    // Try ip-api.com (free, no key needed, CORS allowed)
    fetch("http://ip-api.com/json/?fields=city,country,countryCode,regionName")
      .then(r => r.json())
      .then(d => {
        if (d.country) {
          const loc = { city: d.city || "", country: d.country };
          setIpLocation(loc);
        }
      })
      .catch(() => {
        // Secondary fallback: timezone detection
        try {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const country = tz.includes("Kolkata") || tz.includes("Calcutta") ? "India"
            : tz.split("/")[1]?.replace(/_/g, " ") || "India";
          setIpLocation({ city: "", country });
        } catch { setIpLocation({ city: "", country: "India" }); }
      });
  }, []);

  const handleCategoryChange = (id: string) => {
    onCategoryChange?.(id);
    trackEvent?.({ type: "category_select", category: id });
  };

  const locationLabel = ipLocation?.city
    ? `${ipLocation.city}, ${ipLocation.country}`
    : ipLocation?.country || null;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">

      {/* ═══ DESKTOP HEADER ═══ */}
      <header className="hidden lg:flex items-center bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-3 z-30 shadow-sm shrink-0">
        {/* Left: Logo */}
        <div className="flex-1">
          <button onClick={() => navigate("/")} className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm group-hover:bg-blue-700 transition-colors">
              <span className="text-white text-[17px] leading-none" style={{ fontFamily: "'Pacifico',cursive" }}>s</span>
            </div>
          </button>
        </div>
        {/* Center: site name */}
        <div className="flex-1 flex justify-center">
          <button onClick={() => navigate("/")} className="text-blue-600 dark:text-blue-400 text-2xl font-normal hover:opacity-80 transition-opacity"
            style={{ fontFamily: "'Pacifico',cursive" }}>sphere</button>
        </div>
        {/* Right: location + login */}
        <div className="flex-1 flex items-center justify-end gap-3">
          {locationLabel && (
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-2.5 py-1 rounded-full">
              <IcoMapPin size={12} className="text-blue-500" />
              <span>{locationLabel}</span>
            </div>
          )}
          <button onClick={() => navigate("/login")}
            className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm">
            Login / Register
          </button>
        </div>
      </header>

      {/* ═══ MOBILE HEADER ═══ */}
      <div className="lg:hidden bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shadow-sm shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate("/")}
            className="text-blue-600 dark:text-blue-400 text-xl font-normal leading-none"
            style={{ fontFamily: "'Pacifico',cursive" }}>sphere</button>
          {locationLabel && (
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <IcoMapPin size={11} className="text-blue-500" />
              <span>{locationLabel}</span>
            </div>
          )}
        </div>
        {/* Mobile category chips — below header */}
        <div className="flex gap-2 px-3 pb-2.5 overflow-x-auto scrollbar-hide">
          {CATS.map(c => (
            <button key={c.id} onClick={() => handleCategoryChange(c.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all ${
                activeCategory === c.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}>
              <c.Icon size={13} />{c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ═══ DESKTOP SIDEBAR ═══ */}
        <aside className="hidden lg:flex flex-col w-60 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 shrink-0">

          {/* Section 1 (75%): Categories */}
          <nav className="flex-[3] px-3 py-4 space-y-0.5 overflow-y-auto">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-wider px-3 mb-2">Categories</p>
            {CATS.map(c => (
              <button key={c.id} onClick={() => handleCategoryChange(c.id)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeCategory === c.id
                    ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                }`}>
                <c.Icon size={19} className={activeCategory === c.id ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"} />
                {c.label}
              </button>
            ))}
          </nav>

          {/* Thin divider */}
          <div className="mx-4 h-px bg-gray-100 dark:bg-gray-800" />

          {/* Section 2 (25%): Utilities */}
          <div className="flex-[1] px-3 py-3 space-y-0.5">
            <button onClick={toggleTheme}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all">
              {isDark ? <IcoSun size={18} className="text-yellow-500" /> : <IcoMoon size={18} className="text-gray-400" />}
              {isDark ? "Light Mode" : "Dark Mode"}
            </button>
            <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all">
              <IcoHelp size={18} className="text-gray-400 dark:text-gray-500" />
              Help
            </button>
            <button onClick={() => navigate("/login")}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all mt-1">
              Login / Register
            </button>
          </div>
        </aside>

        {/* ═══ MAIN CONTENT ═══ */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-gray-50 dark:bg-gray-950">
          {children}
        </main>

        {/* ═══ DESKTOP RIGHT PANEL ═══ */}
        <aside className="hidden xl:flex flex-col w-72 shrink-0 overflow-y-auto border-l border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-4 py-4 gap-4">
          <div className="bg-blue-600 rounded-2xl p-5 text-white text-center">
            <p className="text-2xl font-normal mb-1" style={{ fontFamily: "'Pacifico',cursive" }}>sphere</p>
            <p className="text-sm font-semibold mb-1">Your world. Your voice.</p>
            <p className="text-xs text-blue-200 mb-4">Join millions sharing thoughts across India</p>
            <button onClick={() => navigate("/login")}
              className="w-full py-2 bg-white text-blue-700 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors">
              Join for free →
            </button>
          </div>
        </aside>
      </div>

      {/* ═══ MOBILE BOTTOM BAR (guest only) ═══ */}
      <div className="lg:hidden bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-4 py-2 flex items-center gap-3 shrink-0">
        {/* Home + Search circles */}
        <button onClick={() => navigate("/")}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          <IcoHome size={18} className="text-gray-600 dark:text-gray-400" />
        </button>
        <button onClick={() => navigate("/search")}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          <IcoSearch size={18} className="text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex-1" />
        {/* Login/Register pill */}
        <button onClick={() => navigate("/login")}
          className="bg-blue-600 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm">
          Login / Register
        </button>
      </div>
    </div>
  );
}

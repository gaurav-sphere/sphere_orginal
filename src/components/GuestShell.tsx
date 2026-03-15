import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router";
import { useTheme } from "../contexts/ThemeContext";
import {
  CATEGORIES,
  IcoHome, IcoSearch, IcoMapPin,
  IcoMoon, IcoSun, IcoHelp,
} from "../config/categories";
import { PromotionPanel } from "./PromotionPanel";

/* ══════════════════════════════════════════════════════════════
   GuestShell — layout only

   Changes in this version:
   ① Dark mode ripple — View Transitions API, circle expands from
     the toggle button outward (dark) or contracts inward (light)
   ② Search button added to bottom of sidebar categories
   ③ Location via timezone (no API, always works)
   ④ h-[100dvh], fixed mobile header, fixed bottom bar
   ⑤ Sidebar categories scroll, utilities pinned
   ⑥ Promotion panel at lg+
══════════════════════════════════════════════════════════════ */

/* ── Dark mode ripple CSS — pure CSS, works on all browsers ── */
const RIPPLE_CSS = `
  .theme-ripple {
    position: fixed;
    border-radius: 50%;
    pointer-events: none;
    z-index: 99999;
    transform: scale(0);
    background: var(--ripple-color, #030712);
  }
  .theme-ripple.expanding {
    transition: transform 0.55s cubic-bezier(0.4, 0, 0.2, 1),
                opacity   0.55s cubic-bezier(0.4, 0, 0.2, 1);
    transform: scale(1);
    opacity: 1;
  }
  .theme-ripple.done {
    opacity: 0;
    transition: opacity 0.15s ease;
  }
`;

interface GuestShellProps {
  children:        React.ReactNode;
  activeCategory?: string;
  locationLabel?:  string | null;
}

export function GuestShell({ children, activeCategory = "top", locationLabel }: GuestShellProps) {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const mainRef      = useRef<HTMLDivElement>(null);

  /* ── Theme — safe fallback if ThemeContext not ready ── */
  let isDark      = false;
  let toggleTheme = () => {};
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const theme = useTheme();
    isDark       = theme.isDark;
    toggleTheme  = theme.toggleTheme;
  } catch { /* silent */ }

  /* ── Dark mode toggle button refs — used to get ripple origin ── */
  const desktopThemeRef = useRef<HTMLButtonElement>(null);
  const mobileThemeRef  = useRef<HTMLButtonElement>(null);

  /* ── Theme ripple toggle ──
     Creates a circle overlay that expands from the button position.
     Dark→Light: white circle expands.
     Light→Dark: dark circle expands.
     Pure CSS + JS, no View Transitions API needed.
  ── */
  const handleThemeToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn    = e.currentTarget;
    const rect   = btn.getBoundingClientRect();
    const cx     = rect.left + rect.width  / 2;
    const cy     = rect.top  + rect.height / 2;

    /* Compute diameter large enough to cover entire screen */
    const maxDist = Math.hypot(
      Math.max(cx, window.innerWidth  - cx),
      Math.max(cy, window.innerHeight - cy),
    );
    const diameter = maxDist * 2 + 20;

    /* Create overlay circle */
    const ripple = document.createElement("div");
    ripple.className = "theme-ripple";
    ripple.style.cssText = `
      width:  ${diameter}px;
      height: ${diameter}px;
      left:   ${cx - diameter / 2}px;
      top:    ${cy - diameter / 2}px;
      --ripple-color: ${isDark ? "rgba(249,250,251,0.85)" : "rgba(3,7,18,0.82)"};
    `;
    document.body.appendChild(ripple);

    /* Trigger expand on next frame */
    requestAnimationFrame(() => {
      ripple.classList.add("expanding");

      /* At midpoint of animation — switch theme so it's hidden under ripple */
      setTimeout(() => {
        toggleTheme();
      }, 260);

      /* Remove ripple after animation completes */
      setTimeout(() => {
        ripple.classList.add("done");
        setTimeout(() => ripple.remove(), 160);
      }, 500);
    });
  };

  /* ── Mobile header scroll hide/show ── */
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY                       = useRef(0);
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => {
      const cur   = el.scrollTop;
      const delta = cur - lastScrollY.current;
      if (Math.abs(delta) < 6) return;
      setHeaderVisible(cur < 40 || delta < 0);
      lastScrollY.current = cur;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Measure mobile header height for content padding ── */
  const mobileHeaderRef = useRef<HTMLDivElement>(null);
  const [mobileHeaderH, setMobileHeaderH] = useState(88);
  const isOnSearch = pathname === "/search" || pathname === "/guest-search";
  useEffect(() => {
    const measure = () => {
      if (mobileHeaderRef.current)
        setMobileHeaderH(mobileHeaderRef.current.offsetHeight);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isOnSearch]);

  /* ── Page helpers ── */
  const isOnHome = pathname === "/";
  const showChips = !isOnSearch;

  /* ── Home: navigate or scroll to top ── */
  const handleHome = () => {
    if (isOnHome) mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    else navigate("/");
  };

  const handleCategory = (id: string) => navigate(`/category/${id}`);

  return (
    <>
      {/* Inject ripple CSS once */}
      <style>{RIPPLE_CSS}</style>

      <div className="h-[100dvh] flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950 transition-colors">

        {/* ════════════════ DESKTOP HEADER ════════════════ */}
        <header className="hidden lg:flex items-center shrink-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-3 z-30 shadow-sm">
          <div className="flex-1">
            <button onClick={() => navigate("/")} className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm group-hover:bg-blue-700 transition-colors">
                <span className="text-white text-[17px] leading-none" style={{ fontFamily: "'Pacifico', cursive" }}>s</span>
              </div>
            </button>
          </div>
          <div className="flex-1 flex justify-center">
            <button onClick={() => navigate("/")}
              className="text-blue-600 dark:text-blue-400 text-2xl font-normal hover:opacity-80 transition-opacity"
              style={{ fontFamily: "'Pacifico', cursive" }}>sphere</button>
          </div>
          <div className="flex-1 flex items-center justify-end gap-3">
            {locationLabel && (
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-2.5 py-1 rounded-full">
                <IcoMapPin size={12} className="text-blue-500 shrink-0" />
                <span className="truncate max-w-[140px]">{locationLabel}</span>
              </div>
            )}
            <button onClick={() => navigate("/login")}
              className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap">
              Login / Register
            </button>
          </div>
        </header>

        {/* ════════════════ MOBILE HEADER (fixed) ════════════════ */}
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
          <div className="flex items-center justify-between px-4 py-3 gap-2">
            <button onClick={() => navigate("/")}
              className="text-blue-600 dark:text-blue-400 text-xl font-normal leading-none shrink-0"
              style={{ fontFamily: "'Pacifico', cursive" }}>sphere</button>
            <div className="flex items-center gap-2 min-w-0">
              {/* Dark mode toggle */}
              <button
                ref={mobileThemeRef}
                onClick={handleThemeToggle}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
              >
                {isDark ? <IcoSun size={15} className="text-yellow-500" /> : <IcoMoon size={15} className="text-gray-500" />}
              </button>
              {/* Location */}
              {locationLabel && (
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 min-w-0">
                  <IcoMapPin size={11} className="text-blue-500 shrink-0" />
                  <span className="truncate max-w-[110px]">{locationLabel}</span>
                </div>
              )}
            </div>
          </div>

          {/* Category chips — hidden on search page */}
          {showChips && (
            <div className="flex gap-2 px-3 pb-2.5 overflow-x-auto scrollbar-hide">
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => handleCategory(c.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all ${
                    activeCategory === c.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}>
                  <c.Icon size={12} />
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ════════════════ BODY ════════════════ */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── LEFT SIDEBAR ── */}
          <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 overflow-hidden">

            {/* Categories — scrollable */}
            <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-0.5">
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-wider px-3 mb-2">
                Categories
              </p>
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => handleCategory(c.id)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeCategory === c.id
                      ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                  }`}>
                  <c.Icon size={19}
                    className={activeCategory === c.id
                      ? "text-blue-600 dark:text-blue-400 shrink-0"
                      : "text-gray-400 dark:text-gray-500 shrink-0"} />
                  {c.label}
                </button>
              ))}

              {/* Search button — bottom of categories */}
              <div className="pt-1">
                <div className="h-px bg-gray-100 dark:bg-gray-800 mx-0 mb-1" />
                <button
                  onClick={() => navigate("/search")}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isOnSearch
                      ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                  }`}>
                  <IcoSearch size={19}
                    className={isOnSearch
                      ? "text-blue-600 dark:text-blue-400 shrink-0"
                      : "text-gray-400 dark:text-gray-500 shrink-0"} />
                  Search
                </button>
              </div>
            </nav>

            {/* Divider */}
            <div className="mx-4 h-px bg-gray-100 dark:bg-gray-800 shrink-0" />

            {/* Utilities — pinned */}
            <div className="shrink-0 px-3 py-3 space-y-0.5">
              <button
                ref={desktopThemeRef}
                onClick={handleThemeToggle}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all"
              >
                {isDark
                  ? <IcoSun  size={18} className="text-yellow-500 shrink-0" />
                  : <IcoMoon size={18} className="text-gray-400 shrink-0" />}
                {isDark ? "Light Mode" : "Dark Mode"}
              </button>
              <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all">
                <IcoHelp size={18} className="text-gray-400 dark:text-gray-500 shrink-0" />
                Help
              </button>
              <button onClick={() => navigate("/login")}
                className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all mt-1">
                Login / Register
              </button>
            </div>
          </aside>

          {/* ── MAIN CONTENT — only scrollable element ── */}
          <main
            ref={mainRef}
            className="flex-1 min-w-0 overflow-y-auto bg-gray-50 dark:bg-gray-950 pb-16 lg:pb-0"
            style={{ paddingTop: `${mobileHeaderH}px` }}
          >
            <div className="lg:pt-0" style={{ paddingTop: 0 }}>
              {children}
            </div>
          </main>

          {/* ── RIGHT PROMOTION PANEL — lg+ ── */}
          <aside className="hidden lg:flex flex-col w-64 shrink-0 overflow-y-auto border-l border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-3 py-4">
            <PromotionPanel />
          </aside>
        </div>

        {/* ════════════════ MOBILE BOTTOM BAR (fixed) ════════════════ */}
        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-4 py-2 flex items-center gap-3"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          <button onClick={handleHome}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
              isOnHome
                ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}>
            <IcoHome size={18} />
          </button>

          <button onClick={() => navigate("/search")}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
              isOnSearch
                ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}>
            <IcoSearch size={18} />
          </button>

          <div className="flex-1" />

          <button onClick={() => navigate("/login")}
            className="bg-blue-600 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap">
            Login / Register
          </button>
        </div>

      </div>
    </>
  );
}

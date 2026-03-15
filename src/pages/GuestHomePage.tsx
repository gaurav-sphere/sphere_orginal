import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { useGuest } from "../contexts/GuestContext";
import { GuestShell } from "../components/GuestShell";
import { PostCard } from "../components/PostCard";
import { LoginGateSheet } from "../components/LoginGateSheet";
import { fetchFeedPosts, type LivePost } from "../services/feedService";

/* ══════════════════════════════════════════════════════════════
   GuestHomePage — logic and data only
   ── Responsibilities ──
   • Fetch posts for active category
   • Fetch IP-based location → pass to GuestShell (mobile header only)
   • Show cookie consent bar
   • Show location permission prompt (timed, once)
   • Enforce guest post limit (20 posts → gate)
   • All guest actions blocked → LoginGateSheet
   ── Does NOT ──
   • Handle layout (GuestShell does that)
   • Show visit-count banners
   • Show location in feed body
══════════════════════════════════════════════════════════════ */

const GUEST_POST_LIMIT = 20;

/* ── Inline skeleton (until PostCard phase) ── */
function PostSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 animate-pulse">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-32 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-4/5 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-32 w-full rounded-xl bg-gray-200 dark:bg-gray-700 mt-2" />
        </div>
      </div>
    </div>
  );
}

/* ── Guest gate — shown after GUEST_POST_LIMIT posts ── */
function GuestGate() {
  const navigate = useNavigate();
  return (
    <div className="bg-gradient-to-b from-white dark:from-gray-900 to-blue-50 dark:to-blue-950 p-8 text-center border-b border-gray-100 dark:border-gray-800">
      <p className="font-bold text-gray-900 dark:text-white text-base mb-1">
        You've seen {GUEST_POST_LIMIT} quotes 👀
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Sign up free to get your personalised feed and see more.
      </p>
      <button
        onClick={() => navigate("/login")}
        className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
      >
        Join Sphere — It's Free →
      </button>
    </div>
  );
}

/* ── Empty feed state ── */
function EmptyFeed() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400 px-6">
      <span className="text-4xl mb-3">📭</span>
      <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">
        No quotes yet
      </p>
      <p className="text-xs text-center">Be the first — sign up and post something!</p>
      <button
        onClick={() => navigate("/login")}
        className="mt-4 bg-blue-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
      >
        Join Sphere
      </button>
    </div>
  );
}

/* ── Location prompt sheet ── */
function LocationPrompt({ onAllow, onSkip }: { onAllow: () => void; onSkip: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onSkip} />
      <div className="relative w-full max-w-sm mx-auto bg-white dark:bg-gray-900 rounded-t-3xl lg:rounded-3xl p-6 shadow-2xl">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
            <span className="text-3xl">📍</span>
          </div>
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-2">
          See what's near you
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6 leading-relaxed">
          Sphere shows trending topics from your city.
          We never store your exact location.
        </p>
        <div className="space-y-2.5">
          <button
            onClick={onAllow}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all"
          >
            Allow Location
          </button>
          <button
            onClick={onSkip}
            className="w-full py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-semibold transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Cookie consent bar ── */
function CookieBar({ onAccept, onEssential }: { onAccept: () => void; onEssential: () => void }) {
  return (
    <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-3 shadow-lg">
      <div className="max-w-2xl mx-auto flex items-center gap-3 flex-wrap">
        <p className="flex-1 text-xs text-gray-600 dark:text-gray-400 min-w-[200px]">
          Sphere uses cookies to personalise your feed.{" "}
          <a href="#" className="text-blue-600 underline">Privacy Policy</a>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onEssential}
            className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
          >
            Essential only
          </button>
          <button
            onClick={onAccept}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Main component
══════════════════════════════════════════════════════════════ */
export function GuestHomePage() {
  const {
    locationPermission,
    cookieConsent,
    requestLocation,
    skipLocation,
    acceptCookies,
    essentialCookies,
  } = useGuest();

  /* ── Active category state ── */
  const [activeCategory, setActiveCategory] = useState("top");

  /* ── Posts ── */
  const [posts,   setPosts]   = useState<LivePost[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── Login gate ── */
  const [gateAction, setGateAction] = useState<string | null>(null);

  /* ── Location prompt (shown 1.5s after first load if permission pending) ── */
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  useEffect(() => {
    if (locationPermission === "pending") {
      const t = setTimeout(() => setShowLocationPrompt(true), 1500);
      return () => clearTimeout(t);
    }
  }, [locationPermission]);

  /* ── Timezone-based location — no API, no rate limits, always works ──
     Shows country name derived from IANA timezone.
     e.g. "Asia/Kolkata" → "India", "America/New_York" → "New York"
     Passed to GuestShell for mobile header display only.
  ── */
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Map common Indian timezones to country name
      const tzCountryMap: Record<string, string> = {
        "Asia/Kolkata":   "India",
        "Asia/Calcutta":  "India",
        "Asia/Mumbai":    "India",
        "Asia/Delhi":     "India",
      };
      if (tzCountryMap[tz]) {
        setLocationLabel(tzCountryMap[tz]);
        return;
      }
      // Generic: take last segment, replace underscores
      const parts  = tz.split("/");
      const region = parts[parts.length - 1].replace(/_/g, " ");
      setLocationLabel(region || null);
    } catch { /* silent — location is optional */ }
  }, []);

  /* ── Fetch posts on category change ── */
  const loadPosts = useCallback(async (cat: string) => {
    setLoading(true);
    setPosts([]);
    const data = await fetchFeedPosts(cat, 0, GUEST_POST_LIMIT + 5);
    setPosts(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPosts(activeCategory);
  }, [activeCategory, loadPosts]);

  /* ── Category change: update local state + navigate ── */
  const handleCategoryChange = (id: string) => {
    setActiveCategory(id);
  };

  /* ── Location allow handler ── */
  const handleAllow = async () => {
    setShowLocationPrompt(false);
    await requestLocation();
  };

  return (
    <>
      <GuestShell
        activeCategory={activeCategory}
        locationLabel={locationLabel}
      >
        {/* Feed */}
        <div className="page-enter">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <PostSkeleton key={i} />)
          ) : posts.length === 0 ? (
            <EmptyFeed />
          ) : (
            <>
              {posts.slice(0, GUEST_POST_LIMIT).map(post => (
                <PostCard
                  key={post.id}
                  post={post as any}
                  isLoggedIn={false}
                  /* All interactive actions trigger the gate */
                  onGatedAction={(action: string) => setGateAction(action)}
                />
              ))}
              {posts.length >= GUEST_POST_LIMIT && <GuestGate />}
            </>
          )}
        </div>
      </GuestShell>

      {/* Location prompt */}
      {showLocationPrompt && (
        <LocationPrompt
          onAllow={handleAllow}
          onSkip={() => { setShowLocationPrompt(false); skipLocation(); }}
        />
      )}

      {/* Cookie bar — shown above mobile bottom bar (bottom-16) */}
      {cookieConsent === "pending" && !showLocationPrompt && (
        <CookieBar onAccept={acceptCookies} onEssential={essentialCookies} />
      )}

      {/* Login gate sheet */}
      {gateAction && (
        <LoginGateSheet
          action={gateAction as any}
          onClose={() => setGateAction(null)}
        />
      )}
    </>
  );
}

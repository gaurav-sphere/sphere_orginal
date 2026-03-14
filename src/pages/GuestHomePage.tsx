import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { MapPin, Loader2, ChevronRight } from "lucide-react";
import { PostCard } from "../components/PostCard";
import { GuestShell } from "../components/GuestShell";
import { useGuest } from "../contexts/GuestContext";
import { fetchFeedPosts, type LivePost } from "../services/feedService";

const CATS = ["top","city","sports","science","entertainment","national","world"];
const GUEST_POST_LIMIT = 20;   // show gate after 20 posts

/* ── Skeleton ── */
function PostSkeleton() {
  return (
    <div className="bg-white border-b border-gray-100 px-4 py-3">
      <div className="flex gap-3">
        <div className="skeleton w-10 h-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3.5 w-32 rounded" />
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-4/5 rounded" />
          <div className="skeleton h-32 w-full rounded-xl mt-2" />
        </div>
      </div>
    </div>
  );
}

/* ── Location prompt ── */
function LocationPrompt({ onAllow, onSkip }: { onAllow: () => void; onSkip: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onSkip} />
      <div className="relative w-full max-w-sm mx-auto bg-white rounded-t-3xl lg:rounded-3xl p-6 shadow-2xl sheet-up">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
            <MapPin size={28} className="text-blue-600" />
          </div>
        </div>
        <h2 className="text-lg font-bold text-gray-900 text-center mb-2">See what's near you</h2>
        <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
          Sphere uses your location to show trending topics and quotes from your city.
          We never store your exact location.
        </p>
        <div className="space-y-2.5">
          <button onClick={onAllow}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
            <MapPin size={16} /> Allow Location
          </button>
          <button onClick={onSkip}
            className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 font-semibold transition-colors">
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
    <div className="fixed bottom-12 lg:bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 px-4 py-3 shadow-lg">
      <div className="max-w-2xl mx-auto flex items-center gap-3 flex-wrap">
        <p className="flex-1 text-xs text-gray-600 min-w-[200px]">
          Sphere uses cookies to personalise your feed.{" "}
          <a href="#" className="text-blue-600 underline">Privacy Policy</a>
        </p>
        <div className="flex gap-2 shrink-0">
          <button onClick={onEssential} className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 font-medium">
            Essential only
          </button>
          <button onClick={onAccept} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold">
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Sign-up gate shown after GUEST_POST_LIMIT posts ── */
function GuestGate() {
  const navigate = useNavigate();
  return (
    <div className="bg-gradient-to-b from-white to-blue-50 p-8 text-center border-b border-gray-100">
      <p className="font-bold text-gray-900 text-base mb-1">
        You've seen {GUEST_POST_LIMIT} quotes 👀
      </p>
      <p className="text-sm text-gray-500 mb-4">
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

/* ── Main component ── */
export function GuestHomePage() {
  const navigate = useNavigate();
  const {
    location, locationPermission, cookieConsent,
    requestLocation, skipLocation, acceptCookies, essentialCookies,
    visitCount,
  } = useGuest();

  const [activeCategory, setActiveCategory]         = useState("top");
  const [posts, setPosts]                           = useState<LivePost[]>([]);
  const [loading, setLoading]                       = useState(true);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);

  /* Show location prompt shortly after first load */
  useEffect(() => {
    if (locationPermission === "pending") {
      const t = setTimeout(() => setShowLocationPrompt(true), 1200);
      return () => clearTimeout(t);
    }
  }, [locationPermission]);

  /* Load posts when category changes */
  const loadPosts = useCallback(async (cat: string) => {
    setLoading(true);
    // Fetch a few more than the limit so we always have something to show
    const data = await fetchFeedPosts(cat, 0, GUEST_POST_LIMIT + 5);
    setPosts(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPosts(activeCategory);
  }, [activeCategory]);

  const handleAllow = async () => {
    setShowLocationPrompt(false);
    await requestLocation();
  };

  const locationLabel = location?.city || location?.country || null;

  return (
    <>
      <GuestShell
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        location={location}
      >
        {/* Location context banner */}
        {locationLabel && (
          <div className="lg:hidden flex items-center gap-1.5 px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 font-semibold">
            <MapPin size={12} />
            Trending in {locationLabel}
          </div>
        )}

        {/* Returning visitor nudge */}
        {visitCount >= 3 && !loading && (
          <div className="mx-4 mt-3 mb-1 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-4 text-white flex items-center gap-3">
            <div className="flex-1">
              <p className="font-bold text-sm">You visit often! 👋</p>
              <p className="text-xs text-blue-200 mt-0.5">
                Get a personalised feed by joining Sphere for free.
              </p>
            </div>
            <button
              onClick={() => navigate("/login")}
              className="shrink-0 bg-white text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-50 transition-colors flex items-center gap-1"
            >
              Join <ChevronRight size={13} />
            </button>
          </div>
        )}

        {/* Feed */}
        <div className="page-enter">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <PostSkeleton key={i} />)
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <span className="text-4xl mb-3">📭</span>
              <p className="text-sm font-medium">No quotes in this category yet</p>
              <p className="text-xs mt-1">Be the first — sign up and post something!</p>
              <button
                onClick={() => navigate("/login")}
                className="mt-4 bg-blue-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
              >
                Join Sphere
              </button>
            </div>
          ) : (
            <>
              {posts.slice(0, GUEST_POST_LIMIT).map((post) => (
                <PostCard
                  key={post.id}
                  post={post as any}
                  isLoggedIn={false}   /* guest — all actions show login gate */
                />
              ))}
              {/* Gate after limit */}
              {posts.length >= GUEST_POST_LIMIT && <GuestGate />}
            </>
          )}
        </div>
      </GuestShell>

      {/* Location prompt */}
      {showLocationPrompt && (
        <LocationPrompt onAllow={handleAllow} onSkip={() => { setShowLocationPrompt(false); skipLocation(); }} />
      )}

      {/* Cookie bar */}
      {cookieConsent === "pending" && !showLocationPrompt && (
        <CookieBar onAccept={acceptCookies} onEssential={essentialCookies} />
      )}
    </>
  );
}

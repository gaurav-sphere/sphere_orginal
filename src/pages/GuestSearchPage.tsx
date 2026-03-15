import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Search, X, TrendingUp, Users,
  Flame, Building2, Trophy, FlaskConical, Tv, Newspaper,
} from "lucide-react";
import { GuestShell } from "../components/GuestShell";
import { PostCard } from "../components/PostCard";
import { LoginGateSheet } from "../components/LoginGateSheet";
import { supabase } from "../lib/supabase";

/* ══════════════════════════════════════════════════════════════
   GuestSearchPage
   Route: /search

   MOBILE  — full screen: logo only top-left, no bottom bar, no chips
   DESKTOP — inside GuestShell, sidebar + promo stay visible

   FILTER TABS (with lucide icons):
   1. Trending      — top hashtags overall
   2. People 🔒     — locked, triggers LoginGateSheet
   3. City          — hashtags from city/location-related posts
                      (currently country-level via timezone; city
                       detection will improve when GuestHomePage
                       location system is upgraded — TODO)
   4. Sports        — sports-related trending hashtags
   5. Entertainment — entertainment hashtags
   6. Science & Tech— science/tech hashtags
   7. News          — national/world news hashtags

   Each tab shows:
   — If no query: trending hashtags for that category fetched from DB
   — If query typed: post search results filtered by query

   DATA: Real Supabase queries, no mockData
══════════════════════════════════════════════════════════════ */

/* ── Category-to-keywords mapping for hashtag filtering ── */
const CAT_KEYWORDS: Record<string, string[]> = {
  trending:      [], // no filter — all posts
  city: [
    "city","local","mumbai","delhi","bangalore","bengaluru","chennai",
    "kolkata","hyderabad","pune","ahmedabad","jaipur","surat","lucknow",
    "kochi","chandigarh","guwahati","nagpur","indore","bhopal","metro",
    "town","village","ward","municipality",
  ],
  sports: [
    "cricket","ipl","bcci","football","soccer","hockey","kabaddi",
    "badminton","tennis","basketball","wrestling","boxing","athletics",
    "olympics","cwg","fifa","uefa","nba","f1","formula1","motogp",
    "chess","esports","match","tournament","league","worldcup","t20",
    "sports","game","player","score","win","loss","trophy",
  ],
  entertainment: [
    "bollywood","hollywood","movie","film","series","web","netflix",
    "amazon","hotstar","ott","music","song","album","concert","artist",
    "singer","actor","actress","celebrity","drama","comedy","thriller",
    "anime","manga","meme","viral","trending","youtube","instagram",
    "reel","tiktok","podcast","book","novel","entertainment",
  ],
  science: [
    "science","tech","technology","ai","artificialintelligence","ml",
    "deeplearning","chatgpt","openai","isro","nasa","space","rocket",
    "satellite","physics","chemistry","biology","research","innovation",
    "startup","coding","programming","javascript","python","app",
    "software","hardware","gadget","phone","laptop","electric","ev",
    "medicine","vaccine","health",
  ],
  news: [
    "india","national","politics","government","parliament","election",
    "vote","policy","law","court","budget","economy","gdp","rbi",
    "army","military","defence","border","flood","disaster","protest",
    "movement","rights","world","global","international","usa","uk",
    "china","russia","war","peace","un","nato","g20","diplomacy",
    "news","breaking","latest",
  ],
};

/* ── Filter tab definitions ── */
const FILTERS = [
  { id: "trending",      label: "Trending",       Icon: Flame,        locked: false },
  { id: "people",        label: "People",          Icon: Users,        locked: true  },
  { id: "city",          label: "City",            Icon: Building2,    locked: false },
  { id: "sports",        label: "Sports",          Icon: Trophy,       locked: false },
  { id: "entertainment", label: "Entertainment",   Icon: Tv,           locked: false },
  { id: "science",       label: "Science & Tech",  Icon: FlaskConical, locked: false },
  { id: "news",          label: "News",            Icon: Newspaper,    locked: false },
];

/* ── Trending hashtag type ── */
interface TrendingTag { tag: string; count: number; }

/* ── Inline skeleton ── */
function Skeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 animate-pulse">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-28 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

/* ── Fetch trending hashtags — filtered by category keywords ── */
async function fetchTrendingForCategory(catId: string): Promise<TrendingTag[]> {
  try {
    const keywords = CAT_KEYWORDS[catId] ?? [];

    let query = supabase
      .from("posts")
      .select("content")
      .order("created_at", { ascending: false })
      .limit(300);

    /* For categories with keywords, filter posts that contain at least one keyword */
    if (keywords.length > 0) {
      /* Build OR filter: content ilike '%keyword1%' or ... */
      const orFilter = keywords.slice(0, 10) // limit to avoid URL too long
        .map(kw => `content.ilike.%${kw}%`)
        .join(",");
      query = query.or(orFilter);
    }

    const { data } = await query;
    if (!data || data.length === 0) return [];

    /* Extract and count hashtags */
    const counts: Record<string, number> = {};
    for (const row of data) {
      const tags = (row.content as string).match(/#[\w\u0900-\u097F]+/g) ?? [];
      for (const t of tags) {
        const key = t.toLowerCase();
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count }));
  } catch {
    return [];
  }
}

/* ── Search posts by query text ── */
async function searchPosts(query: string): Promise<any[]> {
  try {
    const { data } = await supabase
      .from("posts")
      .select(`
        id, content, media_url, created_at,
        likes_count, reposts_count, comments_count, user_id,
        profile:profiles!posts_user_id_fkey (
          name, username, avatar_url, is_verified
        )
      `)
      .ilike("content", `%${query.trim()}%`)
      .order("created_at", { ascending: false })
      .limit(30);

    return (data ?? []).map((p: any) => ({
      id:         p.id,
      content:    p.content,
      timestamp:  timeAgo(p.created_at),
      thoughts:   p.comments_count ?? 0,
      likes:      p.likes_count    ?? 0,
      reposts:    p.reposts_count  ?? 0,
      user: {
        id:         p.user_id,
        name:       p.profile?.name     ?? "User",
        username:   `@${p.profile?.username ?? "user"}`,
        avatar:     p.profile?.avatar_url ?? null,
        isVerified: p.profile?.is_verified ?? false,
      },
      image:       p.media_url ?? null,
      isAnonymous: false,
      isLiked:     false,
      isReposted:  false,
    }));
  } catch {
    return [];
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/* ══════════════════════════════════════════════════════════════
   Inner search content — shared between mobile + desktop
══════════════════════════════════════════════════════════════ */
function SearchContent({
  query, setQuery, activeFilter, setActiveFilter,
  results, trending, searchLoading, trendingLoading,
  gateAction, setGateAction, inputRef,
}: {
  query:           string;
  setQuery:        (q: string) => void;
  activeFilter:    string;
  setActiveFilter: (f: string) => void;
  results:         any[];
  trending:        TrendingTag[];
  searchLoading:   boolean;
  trendingLoading: boolean;
  gateAction:      string | null;
  setGateAction:   (a: string | null) => void;
  inputRef:        React.RefObject<HTMLInputElement>;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full">

      {/* ── Search bar + filter tabs ── */}
      <div className="shrink-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 pt-3 pb-0 sticky top-0 z-10">
        {/* Input */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search Sphere…"
            className="w-full pl-10 pr-9 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 focus:bg-white dark:focus:bg-gray-700 transition-all text-gray-900 dark:text-white placeholder-gray-400"
          />
          {query && (
            <button onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filter tabs — horizontal scroll */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-3">
          {FILTERS.map(f => {
            const active = activeFilter === f.id && !f.locked;
            return (
              <button
                key={f.id}
                onClick={() => {
                  if (f.locked) { setGateAction("search_people"); return; }
                  setActiveFilter(f.id);
                }}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  active
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                <f.Icon size={12} className={active ? "text-white" : "text-gray-500 dark:text-gray-400"} />
                {f.label}{f.locked ? " 🔒" : ""}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {!query.trim() ? (
          /* Trending hashtags for active category */
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-blue-500" />
              <h2 className="font-bold text-gray-900 dark:text-white text-sm">
                {activeFilter === "trending" ? "Trending" : `Trending in ${FILTERS.find(f => f.id === activeFilter)?.label}`}
              </h2>
            </div>

            {trendingLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                ))}
              </div>
            ) : trending.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-600 text-center py-10">
                No trending hashtags yet in this category
              </p>
            ) : (
              trending.map((h, i) => (
                <button
                  key={h.tag}
                  onClick={() => setQuery(h.tag)}
                  className="flex items-center justify-between w-full py-3 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 px-1 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400 dark:text-gray-600 w-5 text-center font-semibold">
                      {i + 1}
                    </span>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {h.tag}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {h.count.toLocaleString()} posts
                      </p>
                    </div>
                  </div>
                  <span className="text-xs bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-semibold">
                    Trending
                  </span>
                </button>
              ))
            )}

            {/* City note — TODO comment for future improvement */}
            {activeFilter === "city" && (
              <p className="text-xs text-gray-400 dark:text-gray-600 text-center mt-4 px-4">
                {/* TODO: Replace country-level location with city-level once
                    GuestHomePage location system supports GPS/precise IP.
                    Currently showing national-level trending as fallback. */}
                Showing national trending. City-level coming soon.
              </p>
            )}
          </div>
        ) : searchLoading ? (
          <Skeleton />
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 px-6">
            <Search size={40} className="mb-3 text-gray-300 dark:text-gray-700" />
            <p className="font-semibold text-gray-600 dark:text-gray-300 mb-1">No results found</p>
            <p className="text-sm text-center">Try different keywords or hashtags</p>
          </div>
        ) : (
          results.map(post => (
            <PostCard key={post.id} post={post} isLoggedIn={false} />
          ))
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   GuestSearchPage — main component
══════════════════════════════════════════════════════════════ */
export function GuestSearchPage() {
  const navigate   = useNavigate();
  const [params]   = useSearchParams();
  const inputRef   = useRef<HTMLInputElement>(null);

  const [query,          setQuery]          = useState(params.get("q") || "");
  const [activeFilter,   setActiveFilter]   = useState("trending");
  const [results,        setResults]        = useState<any[]>([]);
  const [trending,       setTrending]       = useState<TrendingTag[]>([]);
  const [searchLoading,  setSearchLoading]  = useState(false);
  const [trendingLoading,setTrendingLoading]= useState(false);
  const [gateAction,     setGateAction]     = useState<string | null>(null);

  /* Load trending when filter changes */
  useEffect(() => {
    if (activeFilter === "people") return;
    setTrendingLoading(true);
    fetchTrendingForCategory(activeFilter)
      .then(setTrending)
      .finally(() => setTrendingLoading(false));
  }, [activeFilter]);

  /* Search with 400ms debounce */
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      const res = await searchPosts(query);
      setResults(res);
      setSearchLoading(false);
    }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [query]);

  /* Auto-focus */
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const sharedProps = {
    query, setQuery, activeFilter, setActiveFilter,
    results, trending, searchLoading, trendingLoading,
    gateAction, setGateAction, inputRef,
  };

  return (
    <>
      {/* ── MOBILE — full screen, no shell ── */}
      <div className="lg:hidden h-[100dvh] flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
        {/* Logo only */}
        <div className="shrink-0 flex items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <button onClick={() => navigate("/")}
            className="text-blue-600 dark:text-blue-400 text-xl font-normal leading-none"
            style={{ fontFamily: "'Pacifico', cursive" }}>sphere</button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <SearchContent {...sharedProps} />
        </div>
      </div>

      {/* ── DESKTOP — inside GuestShell ── */}
      <div className="hidden lg:block h-[100dvh]">
        <GuestShell>
          <div className="h-full">
            <SearchContent {...sharedProps} />
          </div>
        </GuestShell>
      </div>

      {gateAction && (
        <LoginGateSheet action={gateAction as any} onClose={() => setGateAction(null)} />
      )}
    </>
  );
}

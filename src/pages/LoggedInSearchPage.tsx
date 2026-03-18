import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Search, X, TrendingUp, Users, Building2,
  Flame, Trophy, FlaskConical, Tv, Newspaper,
  UserPlus, Check, Loader2, MessageCircle,
} from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PostCard } from "../components/PostCard";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

/* ── Category keywords (identical to GuestSearchPage) ── */
const CAT_KEYWORDS: Record<string, string[]> = {
  trending: [],
  city: ["city","local","mumbai","delhi","bangalore","bengaluru","chennai","kolkata","hyderabad","pune","ahmedabad","jaipur","surat","lucknow","kochi","chandigarh","guwahati","nagpur","indore","bhopal","metro","town","village"],
  sports: ["cricket","ipl","bcci","football","soccer","hockey","kabaddi","badminton","tennis","basketball","wrestling","boxing","athletics","olympics","cwg","fifa","uefa","nba","f1","formula1","motogp","chess","esports","match","tournament","league","worldcup","t20","sports","game","player","score","win","loss","trophy"],
  entertainment: ["bollywood","hollywood","movie","film","series","web","netflix","amazon","hotstar","ott","music","song","album","concert","artist","singer","actor","actress","celebrity","drama","comedy","thriller","anime","manga","meme","viral","trending","youtube","instagram","reel","tiktok","podcast","book","novel","entertainment"],
  science: ["science","tech","technology","ai","artificialintelligence","ml","deeplearning","chatgpt","openai","isro","nasa","space","rocket","satellite","physics","chemistry","biology","research","innovation","startup","coding","programming","javascript","python","app","software","hardware","gadget","phone","laptop","electric","ev","medicine","vaccine","health"],
  news: ["india","national","politics","government","parliament","election","vote","policy","law","court","budget","economy","gdp","rbi","army","military","defence","border","flood","disaster","protest","movement","rights","world","global","international","usa","uk","china","russia","war","peace","un","nato","g20","diplomacy","news","breaking","latest"],
};

/* ── Filter tabs — all unlocked for logged-in users ── */
const FILTERS = [
  { id: "trending",      label: "Trending",       Icon: Flame        },
  { id: "people",        label: "People",          Icon: Users        },
  { id: "societies",     label: "Societies",       Icon: Building2    },
  { id: "city",          label: "City",            Icon: Building2    },
  { id: "sports",        label: "Sports",          Icon: Trophy       },
  { id: "entertainment", label: "Entertainment",   Icon: Tv           },
  { id: "science",       label: "Science & Tech",  Icon: FlaskConical },
  { id: "news",          label: "News",            Icon: Newspaper    },
];

interface TrendingTag   { tag: string; count: number }
interface PersonResult  { id: string; name: string; username: string; avatar_url: string | null; is_verified: boolean; followers_count: number }
interface SocietyResult { id: string; name: string; handle: string; avatar_url: string | null; members_count: number; is_verified: boolean }

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

async function fetchTrendingForCategory(catId: string): Promise<TrendingTag[]> {
  try {
    const keywords = CAT_KEYWORDS[catId] ?? [];
    let query = supabase.from("posts").select("body").is("deleted_at", null)
      .order("created_at", { ascending: false }).limit(300);
    if (keywords.length > 0) {
      const orFilter = keywords.slice(0, 10).map(kw => `body.ilike.%${kw}%`).join(",");
      query = query.or(orFilter);
    }
    const { data } = await query;
    if (!data?.length) return [];
    const counts: Record<string, number> = {};
    for (const row of data) {
      const tags = ((row.body as string) || "").match(/#[\w\u0900-\u097F]+/g) ?? [];
      for (const t of tags) { const k = t.toLowerCase(); counts[k] = (counts[k] ?? 0) + 1; }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag, count]) => ({ tag, count }));
  } catch { return []; }
}

async function searchPosts(query: string, userId?: string): Promise<any[]> {
  try {
    const { data } = await supabase.from("posts").select(`
      id, body, category, is_anon, created_at,
      likes_count, forwards_count, thoughts_count,
      is_forward, city, hashtags, user_id,
      profiles!posts_user_id_fkey(id, name, username, anon_username, avatar_url, is_verified, is_org),
      post_media(url, media_type, width, height, position)
    `).ilike("body", `%${query.trim()}%`).is("deleted_at", null)
      .order("created_at", { ascending: false }).limit(30);

    let likedIds = new Set<string>();
    if (userId && data?.length) {
      const ids = data.map((p: any) => p.id);
      const { data: praised } = await supabase.from("post_praises").select("post_id").eq("user_id", userId).in("post_id", ids);
      likedIds = new Set((praised || []).map((r: any) => r.post_id));
    }
    return (data ?? []).map((p: any) => {
      const prof = p.profiles || {};
      const av = prof.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(prof.name || "U")}&background=1D4ED8&color=fff&size=80`;
      return {
        id: p.id, body: p.body, content: p.body, category: p.category, is_anon: p.is_anon,
        created_at: p.created_at, timestamp: timeAgo(p.created_at),
        likes_count: p.likes_count || 0, likes: p.likes_count || 0,
        forwards_count: p.forwards_count || 0, reposts: p.forwards_count || 0,
        thoughts_count: p.thoughts_count || 0, thoughts: p.thoughts_count || 0,
        is_forward: p.is_forward || false, city: p.city, hashtags: p.hashtags || [],
        user_id: p.user_id, comments_off: false, is_pinned: false,
        isLiked: likedIds.has(p.id), isReposted: false,
        mediaItems: (p.post_media || []).map((m: any) => ({ type: m.media_type, url: m.url, width: m.width, height: m.height })),
        user: { id: prof.id, name: prof.name || "Unknown", username: `@${prof.username || "user"}`, anon_username: `@${prof.anon_username || "anon"}`, avatar_url: av, avatar: av, is_verified: prof.is_verified || false, isVerified: prof.is_verified || false, is_org: prof.is_org || false },
      };
    });
  } catch { return []; }
}

async function searchPeople(query: string): Promise<PersonResult[]> {
  try {
    const { data } = await supabase.from("profiles").select("id, username, name, avatar_url, is_verified, followers_count")
      .or(`name.ilike.%${query}%,username.ilike.%${query}%`).limit(20);
    return data || [];
  } catch { return []; }
}

async function searchSocieties(query: string): Promise<SocietyResult[]> {
  try {
    const { data } = await supabase.from("societies").select("id, name, handle, avatar_url, members_count, is_verified")
      .ilike("name", `%${query}%`).limit(20);
    return data || [];
  } catch { return []; }
}

/* ── Person row — click goes to /user/:id ── */
function PersonRow({ person, currentUserId }: { person: PersonResult; currentUserId?: string }) {
  const navigate = useNavigate();
  const [following, setFollowing] = useState(false);
  const [imgErr,    setImgErr]    = useState(false);
  const [dmLoading, setDmLoading] = useState(false);

  useEffect(() => {
    if (!currentUserId || !person.id) return;
    supabase.from("follows").select("follower_id").eq("follower_id", currentUserId).eq("following_id", person.id).maybeSingle()
      .then(({ data }) => { if (data) setFollowing(true); });
  }, [currentUserId, person.id]);

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserId) return;
    if (following) {
      setFollowing(false);
      await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", person.id);
    } else {
      setFollowing(true);
      await supabase.from("follows").insert({ follower_id: currentUserId, following_id: person.id });
    }
  };

  const handleDM = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserId || dmLoading) return;
    setDmLoading(true);
    try {
      // Check if conversation already exists (participant order can be either way)
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .or(`and(participant_1.eq.${currentUserId},participant_2.eq.${person.id}),and(participant_1.eq.${person.id},participant_2.eq.${currentUserId})`)
        .maybeSingle();

      if (existing?.id) {
        navigate("/messages");
        return;
      }

      // Create new conversation
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({ participant_1: currentUserId, participant_2: person.id })
        .select("id")
        .single();

      if (newConv?.id) navigate("/messages");
    } catch (e) {
      console.error("DM error:", e);
    }
    setDmLoading(false);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
      onClick={() => navigate(`/user/${person.id}`)}>
      {person.avatar_url && !imgErr ? (
        <img src={person.avatar_url} alt={person.name} onError={() => setImgErr(true)} className="w-11 h-11 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-base">{(person.name || "U")[0].toUpperCase()}</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{person.name}</p>
          {person.is_verified && <span className="w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold shrink-0">✓</span>}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">@{person.username}</p>
      </div>
      {currentUserId !== person.id && (
        <div className="flex items-center gap-1.5 shrink-0">
          {/* DM button */}
          <button onClick={handleDM}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
            title="Send message">
            <MessageCircle size={14} />
          </button>
          {/* Follow button */}
          <button onClick={handleFollow}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              following ? "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300" : "bg-blue-600 text-white hover:bg-blue-700"
            }`}>
            {following ? <><Check size={11} /> Following</> : <><UserPlus size={11} /> Follow</>}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Society row — "Coming soon" state, click → /society/:handle ── */
function SocietyRow({ society }: { society: SocietyResult }) {
  const navigate = useNavigate();
  const [imgErr, setImgErr] = useState(false);
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
      onClick={() => navigate(`/society/${society.handle}`)}>
      {society.avatar_url && !imgErr ? (
        <img src={society.avatar_url} alt={society.name} onError={() => setImgErr(true)} className="w-11 h-11 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-11 h-11 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
          <Building2 size={18} className="text-white" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{society.name}</p>
          {society.is_verified && <span className="w-3.5 h-3.5 bg-indigo-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold shrink-0">✓</span>}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">@{society.handle} · {(society.members_count || 0).toLocaleString("en-IN")} members</p>
      </div>
      <button className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">Join</button>
    </div>
  );
}

/* ── Filter tabs with left/right arrow scroll buttons ── */
function FilterTabs({ filters, activeFilter, setActiveFilter }: {
  filters: typeof FILTERS;
  activeFilter: string;
  setActiveFilter: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft,  setCanLeft]  = useState(false);
  const [canRight, setCanRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => { el.removeEventListener("scroll", checkScroll); window.removeEventListener("resize", checkScroll); };
  }, []);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "right" ? 160 : -160, behavior: "smooth" });
  };

  return (
    <div className="relative flex items-center pb-3">
      {/* Left arrow */}
      {canLeft && (
        <button
          onClick={() => scroll("left")}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors z-10 mr-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 dark:text-gray-300">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}

      {/* Scrollable pills */}
      <div ref={scrollRef} className="flex gap-1 overflow-x-auto scrollbar-hide flex-1">
        {filters.map(f => {
          const active = activeFilter === f.id;
          return (
            <button key={f.id} onClick={() => setActiveFilter(f.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                active ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}>
              <f.Icon size={12} className={active ? "text-white" : "text-gray-500 dark:text-gray-400"} />
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Right arrow */}
      {canRight && (
        <button
          onClick={() => scroll("right")}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors z-10 ml-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 dark:text-gray-300">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <>{Array.from({ length: 4 }).map((_, i) => (
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
    ))}</>
  );
}

/* ══════════════════════════════════════════════════════════════
   SEARCH CONTENT — same structure as GuestSearchPage
══════════════════════════════════════════════════════════════ */
function SearchContent({
  query, setQuery, activeFilter, setActiveFilter,
  results, trending, people, societies,
  searchLoading, trendingLoading, peopleLoading,
  suggestedPeople, suggestLoading,
  currentUserId, inputRef,
}: {
  query: string; setQuery: (q: string) => void;
  activeFilter: string; setActiveFilter: (f: string) => void;
  results: any[]; trending: TrendingTag[]; people: PersonResult[]; societies: SocietyResult[];
  searchLoading: boolean; trendingLoading: boolean; peopleLoading: boolean;
  suggestedPeople: PersonResult[]; suggestLoading: boolean;
  currentUserId?: string; inputRef: React.RefObject<HTMLInputElement>;
}) {
  return (
    <div className="flex flex-col h-full">

      {/* Search bar + filter tabs — sticky top-0, no top-14 */}
      <div className="shrink-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 pt-3 pb-0 sticky top-0 z-10">
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search Sphere…" autoFocus
            className="w-full pl-10 pr-9 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 focus:bg-white dark:focus:bg-gray-700 transition-all text-gray-900 dark:text-white placeholder-gray-400" />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X size={16} />
            </button>
          )}
        </div>
        <FilterTabs filters={FILTERS} activeFilter={activeFilter} setActiveFilter={setActiveFilter} />
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-950">

        {/* SOCIETIES — coming soon */}
        {activeFilter === "societies" && (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mb-4">
              <Building2 size={28} className="text-indigo-500" />
            </div>
            <p className="font-bold text-gray-800 dark:text-white text-lg mb-1">Societies</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Groups for your interests, topics, and communities.</p>
            <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 text-xs font-bold rounded-full">
              Coming Soon
            </span>
            {query.trim() && societies.length > 0 && (
              <div className="w-full mt-6 text-left">{societies.map(s => <SocietyRow key={s.id} society={s} />)}</div>
            )}
          </div>
        )}

        {/* PEOPLE — unlocked, real search */}
        {activeFilter === "people" && (
          <div>
            {!query.trim() ? (
              <div>
                {/* Suggested people header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50 dark:border-gray-800">
                  <Users size={14} className="text-blue-500" />
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Suggested People</p>
                </div>
                {suggestLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={20} className="animate-spin text-blue-400" />
                  </div>
                ) : suggestedPeople.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <Users size={36} className="text-gray-300 dark:text-gray-700 mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No suggestions yet</p>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Search for people by name or @username</p>
                  </div>
                ) : (
                  suggestedPeople.map(p => (
                    <PersonRow key={p.id} person={p} currentUserId={currentUserId} />
                  ))
                )}
              </div>
            ) : peopleLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 size={22} className="animate-spin text-blue-400" /></div>
            ) : people.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 px-6">
                <Users size={40} className="mb-3 text-gray-300 dark:text-gray-700" />
                <p className="font-semibold text-gray-600 dark:text-gray-300 mb-1">No people found</p>
                <p className="text-sm text-center">Try searching by full name or @username</p>
              </div>
            ) : (
              people.map(p => <PersonRow key={p.id} person={p} currentUserId={currentUserId} />)
            )}
          </div>
        )}

        {/* ALL OTHER TABS — trending + post results */}
        {activeFilter !== "people" && activeFilter !== "societies" && (
          <>
            {!query.trim() ? (
              /* Trending — clicking sets query, stays on this page */
              <div className="px-4 py-4">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={16} className="text-blue-500" />
                  <h2 className="font-bold text-gray-900 dark:text-white text-sm">
                    {activeFilter === "trending" ? "Trending" : `Trending in ${FILTERS.find(f => f.id === activeFilter)?.label}`}
                  </h2>
                </div>
                {trendingLoading ? (
                  <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-10 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                  ))}</div>
                ) : trending.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-600 text-center py-10">No trending hashtags yet in this category</p>
                ) : (
                  trending.map((h, i) => (
                    <button key={h.tag} onClick={() => setQuery(h.tag)}
                      className="flex items-center justify-between w-full py-3 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 px-1 rounded-lg transition-colors group">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-400 dark:text-gray-600 w-5 text-center font-semibold">{i + 1}</span>
                        <div className="text-left">
                          <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{h.tag}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{h.count.toLocaleString()} posts</p>
                        </div>
                      </div>
                      <span className="text-xs bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-semibold">Trending</span>
                    </button>
                  ))
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
                <PostCard key={post.id} post={post} isLoggedIn={true} isOwn={post.user_id === currentUserId} />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════════ */
export function LoggedInSearchPage() {
  const [params]  = useSearchParams();
  const inputRef  = useRef<HTMLInputElement>(null);
  const { user }  = useAuth();

  const [query,           setQuery]           = useState(params.get("q") || "");
  const [activeFilter,    setActiveFilter]    = useState("trending");
  const [results,         setResults]         = useState<any[]>([]);
  const [trending,        setTrending]        = useState<TrendingTag[]>([]);
  const [people,          setPeople]          = useState<PersonResult[]>([]);
  const [societies,       setSocieties]       = useState<SocietyResult[]>([]);
  const [searchLoading,   setSearchLoading]   = useState(false);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [peopleLoading,   setPeopleLoading]   = useState(false);
  const [suggestedPeople, setSuggestedPeople] = useState<PersonResult[]>([]);
  const [suggestLoading,  setSuggestLoading]  = useState(false);

  /* Load trending when filter changes */
  useEffect(() => {
    if (activeFilter === "people" || activeFilter === "societies") return;
    setTrendingLoading(true);
    fetchTrendingForCategory(activeFilter).then(setTrending).finally(() => setTrendingLoading(false));
  }, [activeFilter]);

  /* Search debounce */
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const runSearch = (q: string, filter: string, uid?: string) => {
    clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); setPeople([]); setSocieties([]); return; }
    timer.current = setTimeout(async () => {
      if (filter === "people") {
        setPeopleLoading(true);
        setPeople(await searchPeople(q));
        setPeopleLoading(false);
      } else if (filter === "societies") {
        setSocieties(await searchSocieties(q));
      } else {
        setSearchLoading(true);
        setResults(await searchPosts(q, uid));
        setSearchLoading(false);
      }
    }, 400);
  };

  useEffect(() => { runSearch(query, activeFilter, user?.id); }, [query, activeFilter, user?.id]);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  return (
    <AppShell>
      {/* NO mt-14 — AppShell header is in flex flow, not fixed */}
      <div className="h-full flex flex-col">
        <SearchContent
          query={query} setQuery={setQuery}
          activeFilter={activeFilter} setActiveFilter={setActiveFilter}
          results={results} trending={trending} people={people} societies={societies}
          searchLoading={searchLoading} trendingLoading={trendingLoading} peopleLoading={peopleLoading}
          suggestedPeople={suggestedPeople} suggestLoading={suggestLoading}
          currentUserId={user?.id} inputRef={inputRef}
        />
      </div>
    </AppShell>
  );
}

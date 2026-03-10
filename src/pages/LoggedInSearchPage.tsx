import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Search, X, TrendingUp, Users, Building2, Hash,
  Loader2, Zap,
} from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PostCard } from "../components/PostCard";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { fetchTrendingHashtags } from "../services/feedService";
import type { LivePost } from "../services/feedService";

interface UserResult {
  id: string;
  name: string;
  username: string;
  avatar_url: string;
  is_verified: boolean;
  is_org: boolean;
}

interface TrendingTag { tag: string; posts_count: number }

const FILTERS = [
  { id: "top",    label: "Top",           icon: TrendingUp },
  { id: "people", label: "People",        icon: Users },
  { id: "orgs",   label: "Organisations", icon: Building2 },
];

export function LoggedInSearchPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [query, setQuery]           = useState(params.get("q") || "");
  const [activeFilter, setActiveFilter] = useState("top");

  const [trending, setTrending]     = useState<TrendingTag[]>([]);
  const [postResults, setPostResults] = useState<LivePost[]>([]);
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [loadingTrend, setLoadingTrend] = useState(true);
  const [searching, setSearching]   = useState(false);

  /* ── Trending hashtags ── */
  useEffect(() => {
    setLoadingTrend(true);
    fetchTrendingHashtags(20)
      .then(d => { setTrending(d); setLoadingTrend(false); })
      .catch(() => setLoadingTrend(false));
  }, []);

  /* ── Search ── */
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setPostResults([]); setUserResults([]); return; }
    setSearching(true);

    const [postsRes, usersRes] = await Promise.all([
      supabase
        .from("posts")
        .select(`
          id, body, category, is_anon, created_at,
          likes_count, forwards_count, thoughts_count,
          is_forward, city, hashtags, user_id,
          profiles!posts_user_id_fkey(id,name,username,anon_username,avatar_url,is_verified,is_org),
          post_media(url,media_type,position)
        `)
        .ilike("body", `%${q}%`)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("profiles")
        .select("id,name,username,avatar_url,is_verified,is_org")
        .or(`name.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(10),
    ]);

    setPostResults((postsRes.data as unknown as LivePost[]) || []);
    setUserResults((usersRes.data as UserResult[]) || []);
    setSearching(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 400);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  function formatCount(n: number) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toString();
  }

  const people = userResults.filter(u => !u.is_org);
  const orgs   = userResults.filter(u => u.is_org);
  const filteredPosts = activeFilter === "people" || activeFilter === "orgs" ? [] : postResults;
  const filteredPeople = activeFilter === "top" || activeFilter === "people" ? people : [];
  const filteredOrgs   = activeFilter === "top" || activeFilter === "orgs"   ? orgs   : [];

  return (
    <AppShell>
      <div className="page-enter mt-14 lg:mt-0 min-h-screen bg-white">

        {/* Search bar + filters */}
        <div className="bg-white sticky top-14 lg:top-0 z-20 px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2.5">
            <Search size={15} className="text-gray-400 shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search sphere..."
              autoFocus
              className="flex-1 bg-transparent text-sm outline-none text-gray-800 placeholder-gray-400"
            />
            {searching && <Loader2 size={13} className="animate-spin text-gray-400 shrink-0" />}
            {query && !searching && (
              <button onClick={() => setQuery("")} className="shrink-0">
                <X size={14} className="text-gray-400" />
              </button>
            )}
          </div>

          <div className="flex gap-2 mt-2.5 overflow-x-auto scrollbar-hide">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeFilter === f.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <f.icon size={12} />
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* No query: Trending */}
        {!query.trim() && (
          <div>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Zap size={14} className="text-yellow-500" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                Trending in India
              </span>
            </div>
            {loadingTrend ? (
              <div className="flex justify-center py-10">
                <Loader2 size={20} className="animate-spin text-blue-500" />
              </div>
            ) : trending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <span className="text-3xl mb-2">📊</span>
                <p className="text-sm">No trending topics yet</p>
                <p className="text-xs mt-1 text-gray-400">Start posting to see trends here!</p>
              </div>
            ) : trending.map((h, i) => (
              <div
                key={h.tag}
                onClick={() => setQuery(h.tag)}
                className="flex items-center justify-between px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-gray-300 w-5 text-right">{i + 1}</span>
                  <div>
                    <div className="flex items-center gap-1">
                      <Hash size={13} className="text-blue-500" />
                      <span className="text-sm font-bold text-gray-900">{h.tag}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{formatCount(h.posts_count)} posts</p>
                  </div>
                </div>
                <span className="text-xs text-blue-500 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                  Trending
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Search results */}
        {query.trim() && (
          <div>
            {/* People */}
            {filteredPeople.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <Users size={13} className="text-gray-400" />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">People</span>
                </div>
                {filteredPeople.map(u => (
                  <div
                    key={u.id}
                    onClick={() => navigate(`/user/${u.username}`)}
                    className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                  >
                    <img
                      src={u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=1D4ED8&color=fff&size=80`}
                      alt={u.name}
                      className="w-11 h-11 rounded-full object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-gray-900 truncate">{u.name}</span>
                        {u.is_verified && <span className="text-blue-500 text-xs font-bold">✓</span>}
                      </div>
                      <p className="text-xs text-gray-500 truncate">@{u.username}</p>
                    </div>
                    <button className="px-3 py-1.5 bg-blue-600 text-white rounded-full text-xs font-bold hover:bg-blue-700 shrink-0">
                      Follow
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Organisations */}
            {filteredOrgs.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <Building2 size={13} className="text-gray-400" />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Organisations</span>
                </div>
                {filteredOrgs.map(o => (
                  <div
                    key={o.id}
                    onClick={() => navigate(`/user/${o.username}`)}
                    className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                  >
                    <img
                      src={o.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(o.name)}&background=111827&color=fff&size=80`}
                      alt={o.name}
                      className="w-11 h-11 rounded-full object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-gray-900 truncate">{o.name}</span>
                        {o.is_verified && <span className="text-blue-500 text-xs font-bold">✓</span>}
                        <span className="text-[9px] bg-gray-900 text-white px-1.5 py-0.5 rounded ml-1 uppercase">Org</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">@{o.username}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Posts */}
            {filteredPosts.length > 0 && (
              <div>
                {(filteredPeople.length > 0 || filteredOrgs.length > 0) && (
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Posts</span>
                  </div>
                )}
                {filteredPosts.map(p => (
                  <PostCard key={p.id} post={p as any} isLoggedIn={true} />
                ))}
              </div>
            )}

            {/* No results */}
            {!searching &&
              filteredPosts.length === 0 &&
              filteredPeople.length === 0 &&
              filteredOrgs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Search size={32} className="opacity-20 mb-3" />
                <p className="text-sm font-medium">No results for "{query}"</p>
                <p className="text-xs mt-1">Try different keywords or check spelling</p>
              </div>
            )}
          </div>
        )}
        <div className="h-24" />
      </div>
    </AppShell>
  );
}

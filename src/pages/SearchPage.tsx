import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Search, X, TrendingUp } from "lucide-react";
import { GuestShell } from "../components/GuestShell";
import { PostCard } from "../components/PostCard";
import { mockPosts, trendingHashtags } from "../data/mockData";
import { LoginGateSheet } from "../components/LoginGateSheet";

export function SearchPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [gateAction, setGateAction] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");

  const FILTERS = [{ id:"all",label:"Top" },{ id:"content",label:"Content" },{ id:"people",label:"People 🔒" },{ id:"orgs",label:"Orgs 🔒" }];

  const results = query.trim()
    ? mockPosts.filter((p: any) =>
        p.content.toLowerCase().includes(query.toLowerCase()) ||
        p.content.includes(query)
      )
    : [];

  return (
    <>
      <GuestShell>
        <div className="page-enter">
          {/* Search bar */}
          <div className="bg-white sticky top-0 z-10 px-4 py-3 border-b border-gray-100">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search Sphere…"
                autoFocus
                className="w-full pl-10 pr-10 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all text-gray-900"
              />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <X size={16} />
                </button>
              )}
            </div>
            {/* Filters */}
            <div className="flex gap-2 mt-2.5 overflow-x-auto scrollbar-hide">
              {FILTERS.map(f => (
                <button key={f.id} onClick={() => {
                  if (f.id === "people" || f.id === "orgs") { setGateAction("search_people"); return; }
                  setActiveFilter(f.id);
                }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    activeFilter===f.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {!query ? (
            /* Trending */
            <div className="px-4 py-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} className="text-blue-500" />
                <h2 className="font-bold text-gray-900 text-sm">Trending in India</h2>
              </div>
              {trendingHashtags.map((h: any, i: number) => (
                <button key={h.tag} onClick={() => setQuery(h.tag)}
                  className="flex items-center justify-between w-full py-3 border-b border-gray-50 hover:bg-gray-50 px-1 rounded-lg transition-colors group">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400 w-5 text-center font-semibold">{i+1}</span>
                    <div>
                      <p className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{h.tag}</p>
                      <p className="text-xs text-gray-400">{h.posts}</p>
                    </div>
                  </div>
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold">Trending</span>
                </button>
              ))}
            </div>
          ) : (
            <div>
              {results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Search size={40} className="mb-3 text-gray-300" />
                  <p className="font-semibold text-gray-600 mb-1">No results found</p>
                  <p className="text-sm">Try different keywords</p>
                </div>
              ) : (
                results.map((p: any) => <PostCard key={p.id} post={p} isLoggedIn={false} />)
              )}
            </div>
          )}
        </div>
      </GuestShell>
      {gateAction && <LoginGateSheet action={gateAction as any} onClose={() => setGateAction(null)} />}
    </>
  );
}

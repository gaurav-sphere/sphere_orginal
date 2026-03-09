import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Search, X, TrendingUp, Users, Building2 } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PostCard } from "../components/PostCard";
import { mockPosts, mockUsers, trendingHashtags } from "../mockData";

const FILTERS = [
  { id:"top",     label:"Top",           icon:TrendingUp },
  { id:"people",  label:"People",        icon:Users },
  { id:"orgs",    label:"Organisations", icon:Building2 },
  { id:"city",    label:"City",          icon:null },
  { id:"sports",  label:"Sports",        icon:null },
];

export function LoggedInSearchPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [activeFilter, setActiveFilter] = useState("top");

  const postResults = query.trim()
    ? mockPosts.filter((p: any) => p.content.toLowerCase().includes(query.toLowerCase()))
    : [];
  const peopleResults = query.trim()
    ? mockUsers.filter(u => u.name.toLowerCase().includes(query.toLowerCase()) || u.username.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <AppShell>
      <div className="page-enter mt-14 lg:mt-0">
        {/* Search bar */}
        <div className="bg-white sticky top-14 lg:top-0 z-20 px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search Sphere…" autoFocus
              className="w-full pl-10 pr-10 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all text-gray-900" />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={16} /></button>
            )}
          </div>
          <div className="flex gap-2 mt-2.5 overflow-x-auto scrollbar-hide">
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setActiveFilter(f.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${activeFilter===f.id?"bg-blue-600 text-white":"bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {!query ? (
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 mb-4"><TrendingUp size={16} className="text-blue-500" /><h2 className="font-bold text-gray-900 text-sm">Trending</h2></div>
            {trendingHashtags.map((h: any, i: number) => (
              <button key={h.tag} onClick={() => setQuery(h.tag)}
                className="flex items-center justify-between w-full py-3 border-b border-gray-50 hover:bg-gray-50 px-1 rounded-lg transition-colors group">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400 w-5 text-center font-semibold">{i+1}</span>
                  <div>
                    <p className="text-sm font-bold text-gray-900 group-hover:text-blue-600">{h.tag}</p>
                    <p className="text-xs text-gray-400">{h.posts}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div>
            {activeFilter === "people" ? (
              peopleResults.length === 0 ? (
                <p className="text-center py-20 text-gray-400 text-sm">No people found for "{query}"</p>
              ) : (
                peopleResults.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/user/${u.id}`)}>
                    <img src={u.avatar} alt={u.name} className="w-11 h-11 rounded-full object-cover" />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-gray-900 text-sm">{u.name}</p>
                        {u.isVerified && <span className="w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold">✓</span>}
                      </div>
                      <p className="text-xs text-gray-500">{u.username}</p>
                    </div>
                    <button className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-xs font-bold hover:bg-blue-700 transition-colors">Follow</button>
                  </div>
                ))
              )
            ) : (
              postResults.length === 0 ? (
                <p className="text-center py-20 text-gray-400 text-sm">No results for "{query}"</p>
              ) : (
                postResults.map((p: any) => <PostCard key={p.id} post={p} isLoggedIn={true} />)
              )
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

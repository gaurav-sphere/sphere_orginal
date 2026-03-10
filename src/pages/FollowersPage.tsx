import React, { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Search } from "lucide-react";
import { mockUsers } from "../data/mockData";

export function FollowersPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"followers"|"following">("followers");
  const [search, setSearch] = useState("");
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setFollowingMap(p => ({ ...p, [id]: !p[id] }));
  const filtered = mockUsers.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <div className="flex bg-gray-100 rounded-xl p-1 flex-1">
          {(["followers","following"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${activeTab===tab?"bg-white text-gray-900 shadow-sm":"text-gray-500"}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 py-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search"
            className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-xl text-sm focus:outline-none text-gray-900" />
        </div>
      </div>
      {filtered.map(u => (
        <div key={u.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 transition-colors">
          <img src={u.avatar} alt={u.name} className="w-11 h-11 rounded-full object-cover cursor-pointer" onClick={() => navigate(`/user/${u.id}`)} />
          <div className="flex-1 cursor-pointer" onClick={() => navigate(`/user/${u.id}`)}>
            <div className="flex items-center gap-1.5">
              <p className="font-bold text-gray-900 text-sm">{u.name}</p>
              {u.isVerified && <span className="w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold">✓</span>}
            </div>
            <p className="text-xs text-gray-500">{u.username}</p>
          </div>
          <button onClick={() => toggle(u.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${followingMap[u.id]?"border-2 border-gray-200 text-gray-800":"bg-blue-600 text-white hover:bg-blue-700"}`}>
            {followingMap[u.id] ? "Following" : "Follow"}
          </button>
        </div>
      ))}
    </div>
  );
}

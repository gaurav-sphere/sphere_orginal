import React, { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, MessageCircle, Grid3X3, FileText, MapPin, Link2, MoreHorizontal, Flag, UserMinus } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PostCard } from "../components/PostCard";
import { mockUsers, mockProfilePosts } from "../data/mockData";

export function UserProfilePage() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const user = mockUsers.find(u => u.id === userId) ?? mockUsers[1];
  const [following, setFollowing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<"quotes"|"media">("quotes");

  return (
    <AppShell>
      <div className="page-enter mt-14 lg:mt-0 min-h-screen bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-14 lg:top-0 bg-white z-10">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <div className="text-center">
            <p className="font-bold text-gray-900 text-sm">{user.name}</p>
            <p className="text-xs text-gray-400">{mockProfilePosts.length} quotes</p>
          </div>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
              <MoreHorizontal size={20} className="text-gray-600" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-10 z-40 bg-white rounded-2xl shadow-xl border border-gray-100 py-1 min-w-[160px]">
                  <button className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50" onClick={() => setShowMenu(false)}>
                    <UserMinus size={14} />Block
                  </button>
                  <button className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={() => { setShowMenu(false); navigate(`/report/user_${userId}`); }}>
                    <Flag size={14} />Report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Banner */}
        <div className="h-32 bg-gradient-to-r from-blue-500 to-purple-600" />

        {/* Avatar + actions */}
        <div className="px-4 relative -mt-10 flex items-end justify-between mb-3">
          <img src={user.avatar} alt={user.name} className="w-20 h-20 rounded-full object-cover ring-4 ring-white shadow-sm" />
          <div className="flex items-center gap-2 mt-2">
            <button onClick={() => navigate(`/messages?userId=${userId}`)}
              className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
              <MessageCircle size={16} className="text-gray-600" />
            </button>
            <button
              onClick={() => setFollowing(f => !f)}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
                following
                  ? "border-2 border-gray-200 text-gray-800 hover:border-red-200 hover:text-red-500"
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              }`}>
              {following ? "Following" : "Follow"}
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-xl font-extrabold text-gray-900">{user.name}</h1>
            {user.isVerified && (
              <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-500 rounded-full text-[11px] text-white font-bold">✓</span>
            )}
          </div>
          <p className="text-gray-400 text-sm mb-2">@{user.username?.replace(/^@/,"")}</p>
          {user.bio && <p className="text-gray-800 text-sm leading-relaxed mb-2">{user.bio}</p>}
          {user.location && (
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
              <MapPin size={12} className="text-gray-400" />{user.location}
            </div>
          )}
          <div className="flex gap-4 text-sm">
            <button onClick={() => navigate(`/user/${userId}/followers`)} className="hover:underline">
              <span className="font-bold text-gray-900">{(user.followers || 0).toLocaleString()}</span>
              <span className="text-gray-500 ml-1">Followers</span>
            </button>
            <button onClick={() => navigate(`/user/${userId}/followers`)} className="hover:underline">
              <span className="font-bold text-gray-900">{(user.following || 0).toLocaleString()}</span>
              <span className="text-gray-500 ml-1">Following</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {[{ id:"quotes",label:"Quotes",icon:FileText },{ id:"media",label:"Media",icon:Grid3X3 }].map(({ id,label,icon:Icon }) => (
            <button key={id} onClick={() => setActiveTab(id as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-bold border-b-2 transition-all ${activeTab===id?"border-blue-600 text-blue-600":"border-transparent text-gray-500 hover:text-gray-700"}`}>
              <Icon size={15}/>{label}
            </button>
          ))}
        </div>

        {activeTab === "quotes" && mockProfilePosts.map((p: any) => (
          <PostCard key={p.id} post={{ ...p, user: user as any, thoughts: p.thoughts ?? 0 }} isLoggedIn={true} />
        ))}
        {activeTab === "media" && (
          <div className="grid grid-cols-3 gap-0.5 p-0.5">
            {mockProfilePosts.filter((p: any) => p.image).map((p: any) => (
              <div key={p.id} className="aspect-square bg-gray-100 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity">
                <img src={p.image} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-square bg-gray-100 rounded" />)}
          </div>
        )}
      </div>
    </AppShell>
  );
}

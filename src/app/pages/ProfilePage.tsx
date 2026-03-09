import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Settings, Edit3, Grid3X3, FileText, Bookmark, MapPin, Link2, Users } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PostCard } from "../components/PostCard";
import { mockProfilePosts, currentUser } from "../mockData";

const user = currentUser as any;

export function ProfilePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"quotes"|"media"|"saves">("quotes");

  return (
    <AppShell>
      <div className="page-enter mt-14 lg:mt-0 min-h-screen bg-white">
        {/* Banner */}
        <div className="relative h-36 bg-gradient-to-r from-blue-500 to-blue-700 cursor-pointer group"
          onClick={() => navigate("/profile/edit")}>
          {user?.banner && <img src={user.banner} alt="" className="w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white text-sm font-semibold">Change Banner</span>
          </div>
        </div>

        {/* Avatar + actions */}
        <div className="px-4 relative -mt-10 flex items-end justify-between mb-3">
          <div className="relative cursor-pointer group" onClick={() => navigate("/profile/edit")}>
            <img src={user?.avatar} alt={user?.name}
              className="w-20 h-20 rounded-full object-cover ring-4 ring-white shadow-sm" />
            <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Edit3 size={16} className="text-white" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button onClick={() => navigate("/settings")} className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
              <Settings size={16} className="text-gray-600" />
            </button>
            <button onClick={() => navigate("/profile/edit")}
              className="px-4 py-2 border-2 border-gray-200 rounded-full text-sm font-bold text-gray-900 hover:bg-gray-50 transition-colors">
              Edit Profile
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-xl font-extrabold text-gray-900">{user?.name}</h1>
            {user?.isVerified && (
              <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-500 rounded-full text-[11px] text-white font-bold">✓</span>
            )}
          </div>
          <p className="text-gray-400 text-sm mb-2">@{user?.username?.replace(/^@/,"")}</p>
          {user?.bio && <p className="text-gray-800 text-sm leading-relaxed mb-2">{user.bio}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
            {user?.location && (
              <span className="flex items-center gap-1"><MapPin size={12} className="text-gray-400" />{user.location}</span>
            )}
            {user?.website && (
              <a href={user.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                <Link2 size={12} />{user.website}
              </a>
            )}
          </div>
          <div className="flex gap-4 text-sm">
            <button onClick={() => navigate("/profile/followers/me")} className="hover:underline">
              <span className="font-bold text-gray-900">{(user?.followers || 0).toLocaleString()}</span>
              <span className="text-gray-500 ml-1">Followers</span>
            </button>
            <button onClick={() => navigate("/profile/followers/me")} className="hover:underline">
              <span className="font-bold text-gray-900">{(user?.following || 0).toLocaleString()}</span>
              <span className="text-gray-500 ml-1">Following</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {[
            { id:"quotes", label:"Quotes", icon: FileText },
            { id:"media",  label:"Media",  icon: Grid3X3 },
            { id:"saves",  label:"Saved",  icon: Bookmark },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              <Icon size={15} />{label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === "quotes" && (
          <div>
            {mockProfilePosts.map((p: any) => (
              <PostCard key={p.id} post={{ ...p, user: currentUser as any, thoughts: p.thoughts ?? 0 }} isLoggedIn={true} isOwn={true} />
            ))}
          </div>
        )}
        {activeTab === "media" && (
          <div className="grid grid-cols-3 gap-0.5 p-0.5">
            {mockProfilePosts.filter((p: any) => p.image).map((p: any) => (
              <div key={p.id} className="aspect-square bg-gray-100 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity">
                <img src={p.image} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
            {/* placeholder squares */}
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`ph_${i}`} className="aspect-square bg-gray-100 rounded" />
            ))}
          </div>
        )}
        {activeTab === "saves" && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Bookmark size={40} className="mb-3 text-gray-300" />
            <p className="font-semibold text-gray-600 mb-1">No saved quotes yet</p>
            <p className="text-sm">Bookmark quotes to find them here</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

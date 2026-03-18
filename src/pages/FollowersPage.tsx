import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Search, UserPlus, Check, Loader2 } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

interface Person {
  id: string; name: string; username: string;
  avatar_url: string | null; is_verified: boolean;
}

function UserRow({ person, currentUserId }: { person: Person; currentUserId?: string }) {
  const navigate = useNavigate();
  const [following, setFollowing] = useState(false);
  const [imgErr,    setImgErr]    = useState(false);
  const isMe = currentUserId === person.id;

  useEffect(() => {
    if (!currentUserId || isMe) return;
    supabase.from("follows").select("follower_id")
      .eq("follower_id", currentUserId).eq("following_id", person.id).maybeSingle()
      .then(({ data }) => { if (data) setFollowing(true); });
  }, [currentUserId, person.id, isMe]);

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserId || isMe) return;
    if (following) {
      setFollowing(false);
      await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", person.id);
    } else {
      setFollowing(true);
      await supabase.from("follows").insert({ follower_id: currentUserId, following_id: person.id });
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
      onClick={() => navigate(isMe ? "/profile" : `/user/${person.id}`)}>

      {person.avatar_url && !imgErr ? (
        <img src={person.avatar_url} alt={person.name} onError={() => setImgErr(true)}
          className="w-11 h-11 rounded-full object-cover shrink-0"/>
      ) : (
        <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-base">{(person.name||"U")[0].toUpperCase()}</span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{person.name}</p>
          {person.is_verified && (
            <span className="w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold shrink-0">✓</span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">@{person.username}</p>
      </div>

      {!isMe && (
        <button onClick={handleFollow}
          className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            following
              ? "border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}>
          {following ? <><Check size={11}/> Following</> : <><UserPlus size={11}/> Follow</>}
        </button>
      )}
    </div>
  );
}

export function FollowersPage() {
  const navigate = useNavigate();
  const params   = useParams<{ userId?: string }>();
  const { user: me } = useAuth();

  /* userId from URL — could be /profile/followers/:userId or /user/:userId/followers */
  const profileId = params.userId || me?.id || "";

  const [activeTab, setActiveTab] = useState<"followers"|"following">("followers");
  const [search,    setSearch]    = useState("");
  const [followers, setFollowers] = useState<Person[]>([]);
  const [following, setFollowing] = useState<Person[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const loadData = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);

    /* Followers — people who follow this profile */
    const { data: frs } = await supabase
      .from("follows")
      .select("profiles!follows_follower_id_fkey(id, name, username, avatar_url, is_verified)")
      .eq("following_id", profileId);
    const followerList = (frs || []).map((r: any) => r.profiles).filter(Boolean) as Person[];
    setFollowers(followerList);
    setFollowersCount(followerList.length);

    /* Following — people this profile follows */
    const { data: fing } = await supabase
      .from("follows")
      .select("profiles!follows_following_id_fkey(id, name, username, avatar_url, is_verified)")
      .eq("follower_id", profileId);
    const followingList = (fing || []).map((r: any) => r.profiles).filter(Boolean) as Person[];
    setFollowing(followingList);
    setFollowingCount(followingList.length);

    setLoading(false);
  }, [profileId]);

  useEffect(() => { loadData(); }, [loadData]);

  const list = (activeTab === "followers" ? followers : following).filter(p => {
    const q = search.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q);
  });

  return (
    <AppShell>
      <div className="min-h-screen bg-white dark:bg-gray-950">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300"/>
          </button>

          {/* Segmented tabs with counts */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 flex-1">
            {([
              { id:"followers", label:"Followers", count:followersCount },
              { id:"following", label:"Following",  count:followingCount },
            ] as const).map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                  activeTab===tab.id ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400"
                }`}>
                {tab.label}
                <span className={`text-[10px] font-bold ${activeTab===tab.id ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-600"}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-2.5 border-b border-gray-50 dark:border-gray-800">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 text-gray-900 dark:text-white placeholder-gray-400"/>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={22} className="animate-spin text-blue-400"/>
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 px-6 text-center">
            <p className="font-semibold text-gray-600 dark:text-gray-300 mb-1">
              {search ? "No results" : activeTab === "followers" ? "No followers yet" : "Not following anyone yet"}
            </p>
            <p className="text-sm">
              {!search && activeTab === "followers" ? "When people follow this account, they'll appear here." : ""}
            </p>
          </div>
        ) : (
          list.map(p => <UserRow key={p.id} person={p} currentUserId={me?.id}/>)
        )}
      </div>
    </AppShell>
  );
}

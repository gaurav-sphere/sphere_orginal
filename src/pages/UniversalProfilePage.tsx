import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft, MessageCircle, Grid3X3, FileText,
  MapPin, Link2, MoreHorizontal, Flag, UserMinus,
  Lock, Loader2, Repeat2, UserPlus, Check,
} from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PostCard } from "../components/PostCard";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

/*
  UniversalProfilePage
  ────────────────────
  Handles two URL patterns:
    /profile/:username   → look up by username
    /user/:userId        → look up by UUID (legacy), redirects to /profile/:username

  If the viewed profile belongs to the logged-in user → renders own ProfilePage UI.
  Otherwise → renders the other-user profile UI.

  Sets document.title and meta description for SEO.
*/

const POST_SELECT = `
  id, body, category, is_anon, created_at,
  likes_count, forwards_count, thoughts_count,
  is_forward, forward_of, forward_comment,
  city, hashtags, user_id, comments_off, is_pinned,
  profiles!posts_user_id_fkey (
    id, name, username, anon_username, avatar_url, is_verified, is_org
  ),
  post_media (url, media_type, width, height, position)
`;

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h  < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function buildPost(row: any): any {
  const prof = row.profiles || {};
  const media = (row.post_media || []).sort((a: any, b: any) => a.position - b.position);
  const av = prof.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(prof.name||"U")}&background=1D4ED8&color=fff&size=80`;
  return {
    id: row.id, body: row.body, content: row.body,
    category: row.category||"top", is_anon: row.is_anon||false,
    created_at: row.created_at, timestamp: timeAgo(row.created_at),
    likes_count: row.likes_count||0, likes: row.likes_count||0,
    forwards_count: row.forwards_count||0, reposts: row.forwards_count||0,
    thoughts_count: row.thoughts_count||0, thoughts: row.thoughts_count||0,
    is_forward: row.is_forward||false, forward_of: row.forward_of||null,
    forward_comment: row.forward_comment||null,
    city: row.city, hashtags: row.hashtags||[], user_id: row.user_id,
    comments_off: row.comments_off||false, is_pinned: row.is_pinned||false,
    isLiked: false, isReposted: false,
    mediaItems: media.map((m: any) => ({ type: m.media_type, url: m.url, width: m.width, height: m.height })),
    user: {
      id: prof.id, name: prof.name||"Unknown",
      username: `@${prof.username||"user"}`, anon_username: `@${prof.anon_username||"anon"}`,
      avatar_url: av, avatar: av,
      is_verified: prof.is_verified||false, isVerified: prof.is_verified||false,
      is_org: prof.is_org||false,
    },
  };
}

interface Profile {
  id: string; name: string; username: string; bio?: string;
  avatar_url?: string; banner_url?: string; location?: string;
  website_url?: string; website_label?: string;
  is_verified: boolean; is_private: boolean;
  followers_count: number; following_count: number; posts_count: number;
}

function OwnProfileShell({ profile, userId }: { profile: Profile; userId: string }) {
  const navigate = useNavigate();

  // Re-use the same ProfilePage content for own profile
  // Import-wise this is the same code but embedded here to avoid circular deps.
  // For simplicity, redirect to /profile (own profile page).
  useEffect(() => {
    navigate("/profile", { replace: true });
  }, []);
  return null;
}

export function UniversalProfilePage() {
  const navigate           = useNavigate();
  const params             = useParams<{ username?: string; userId?: string }>();
  const { user: me }       = useAuth();

  // Could be /profile/:username or /user/:userId
  const rawParam = params.username || params.userId || "";
  const isUUID   = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawParam);

  const [profile,      setProfile]      = useState<Profile|null>(null);
  const [loading,      setLoading]      = useState(true);
  const [following,    setFollowing]    = useState(false);
  const [activeTab,    setActiveTab]    = useState<"quotes"|"forwards"|"media">("quotes");
  const [showMenu,     setShowMenu]     = useState(false);
  const [avatarErr,    setAvatarErr]    = useState(false);

  const [quotes,       setQuotes]       = useState<any[]>([]);
  const [forwards,     setForwards]     = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [fwdLoaded,    setFwdLoaded]    = useState(false);

  /* ── Fetch profile ── */
  useEffect(() => {
    setLoading(true); setAvatarErr(false); setProfile(null);

    (async () => {
      let q = supabase.from("profiles")
        .select("id,name,username,bio,avatar_url,banner_url,location,website_url,website_label,is_verified,is_private,followers_count,following_count,posts_count");

      if (isUUID) {
        q = q.eq("id", rawParam);
      } else {
        q = q.eq("username", rawParam);
      }

      const { data } = await q.single();
      if (!data) { setLoading(false); return; }

      // If UUID param and we found a username, redirect to canonical URL
      if (isUUID && data.username) {
        navigate(`/profile/${data.username}`, { replace: true });
        return;
      }

      // If this is the logged-in user's own profile, redirect to /profile
      if (me?.id && data.id === me.id) {
        navigate("/profile", { replace: true });
        return;
      }

      setProfile(data as Profile);

      // SEO meta
      document.title = `${data.name} (@${data.username}) · Sphere`;
      const metaDesc = document.querySelector("meta[name='description']");
      if (metaDesc) {
        metaDesc.setAttribute("content",
          `${data.name} on Sphere. ${data.bio ? data.bio.slice(0,120) : "Follow to see their quotes."}`
        );
      }
      // OG tags
      const setMeta = (prop: string, content: string) => {
        let el = document.querySelector(`meta[property='${prop}']`) as HTMLMetaElement | null;
        if (!el) { el = document.createElement("meta"); el.setAttribute("property", prop); document.head.appendChild(el); }
        el.setAttribute("content", content);
      };
      setMeta("og:title",       `${data.name} (@${data.username}) · Sphere`);
      setMeta("og:description", data.bio || `Follow ${data.name} on Sphere`);
      if (data.avatar_url) setMeta("og:image", data.avatar_url);
      setMeta("og:url",         window.location.href);
      setMeta("og:type",        "profile");

      setLoading(false);
    })();
  }, [rawParam, isUUID, me?.id, navigate]);

  /* ── Check follow status ── */
  useEffect(() => {
    if (!me?.id || !profile?.id) return;
    supabase.from("follows").select("follower_id")
      .eq("follower_id", me.id).eq("following_id", profile.id).maybeSingle()
      .then(({ data }) => { if (data) setFollowing(true); });
  }, [me?.id, profile?.id]);

  /* ── Load quotes ── */
  useEffect(() => {
    if (!profile?.id) return;
    if (profile.is_private && !following && me?.id !== profile.id) return;
    setPostsLoading(true);
    supabase.from("posts").select(POST_SELECT)
      .eq("user_id", profile.id).eq("is_forward", false).is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setQuotes(data.map(buildPost)); setPostsLoading(false); });
  }, [profile?.id, following]);

  /* ── Load forwards ── */
  const loadForwards = useCallback(async () => {
    if (!profile?.id || fwdLoaded) return;
    const { data } = await supabase.from("posts").select(POST_SELECT)
      .eq("user_id", profile.id).eq("is_forward", true).is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (!data) { setFwdLoaded(true); return; }
    const origIds = data.filter(p => p.forward_of).map(p => p.forward_of as string);
    let origMap: Record<string,any> = {};
    if (origIds.length) {
      const { data: orig } = await supabase.from("posts").select(POST_SELECT).in("id", origIds).is("deleted_at", null);
      (orig||[]).forEach((r: any) => { origMap[r.id] = buildPost(r); });
    }
    setForwards(data.map(r => ({ ...buildPost(r), originalPost: origMap[r.forward_of]||null })));
    setFwdLoaded(true);
  }, [profile?.id, fwdLoaded]);

  useEffect(() => { if (activeTab === "forwards") loadForwards(); }, [activeTab, loadForwards]);

  /* ── Follow/Unfollow ── */
  const handleFollow = async () => {
    if (!me?.id || !profile) return;
    if (following) {
      setFollowing(false);
      setProfile(p => p ? { ...p, followers_count: Math.max(0, p.followers_count-1) } : p);
      await supabase.from("follows").delete().eq("follower_id", me.id).eq("following_id", profile.id);
    } else {
      setFollowing(true);
      setProfile(p => p ? { ...p, followers_count: p.followers_count+1 } : p);
      await supabase.from("follows").insert({ follower_id: me.id, following_id: profile.id });
      await supabase.from("notifications").insert({ user_id: profile.id, actor_id: me.id, type: "follow" }).catch(()=>{});
    }
  };

  /* ── DM ── */
  const handleDM = async () => {
    if (!me?.id || !profile) return;
    const { data: ex } = await supabase.from("conversations")
      .select("id")
      .or(`and(participant_1.eq.${me.id},participant_2.eq.${profile.id}),and(participant_1.eq.${profile.id},participant_2.eq.${me.id})`)
      .maybeSingle();
    if (ex?.id) { navigate(`/messages/${profile.username}`); return; }
    await supabase.from("conversations").insert({ participant_1: me.id, participant_2: profile.id });
    navigate(`/messages/${profile.username}`);
  };

  /* ── Block ── */
  const handleBlock = async () => {
    if (!me?.id || !profile) return;
    await supabase.from("blocks").upsert({ blocker_id: me.id, blocked_id: profile.id }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
    setShowMenu(false);
    navigate(-1);
  };

  if (loading) return (
    <AppShell><div className="flex items-center justify-center min-h-screen"><Loader2 size={28} className="animate-spin text-blue-500"/></div></AppShell>
  );
  if (!profile) return (
    <AppShell>
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-gray-400">
        <p className="font-semibold text-gray-600 dark:text-gray-300">User not found</p>
        <button onClick={() => navigate(-1)} className="text-sm text-blue-600">Go back</button>
      </div>
    </AppShell>
  );

  const isPrivateLocked = profile.is_private && !following;

  return (
    <AppShell>
      <div className="min-h-screen bg-white dark:bg-gray-950">

        {/* Sticky header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300"/>
          </button>
          <div className="text-center">
            <p className="font-bold text-gray-900 dark:text-white text-sm">{profile.name}</p>
            <p className="text-xs text-gray-400">{profile.posts_count.toLocaleString()} quotes</p>
          </div>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <MoreHorizontal size={20} className="text-gray-600 dark:text-gray-400"/>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)}/>
                <div className="absolute right-0 top-11 z-40 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden min-w-[160px]">
                  <button onClick={handleBlock}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                    <UserMinus size={14}/> Block
                  </button>
                  <button onClick={() => { setShowMenu(false); navigate(`/report/user_${profile.id}`); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <Flag size={14}/> Report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Banner */}
        <div className="h-32 bg-gradient-to-r from-blue-500 to-purple-600 overflow-hidden">
          {profile.banner_url && <img src={profile.banner_url} alt="" className="w-full h-full object-cover"/>}
        </div>

        {/* Avatar + action buttons */}
        <div className="px-4 relative -mt-10 flex items-end justify-between mb-3">
          {profile.avatar_url && !avatarErr ? (
            <img src={profile.avatar_url} alt={profile.name} onError={() => setAvatarErr(true)}
              className="w-20 h-20 rounded-full object-cover ring-4 ring-white dark:ring-gray-950 shadow-sm"/>
          ) : (
            <div className="w-20 h-20 rounded-full bg-blue-600 ring-4 ring-white dark:ring-gray-950 shadow-sm flex items-center justify-center">
              <span className="text-white text-3xl font-extrabold">{profile.name[0]?.toUpperCase()||"U"}</span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <button onClick={handleDM}
              className="w-9 h-9 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <MessageCircle size={16} className="text-gray-600 dark:text-gray-400"/>
            </button>
            <button onClick={handleFollow}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-bold transition-all ${
                following
                  ? "border-2 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white hover:border-red-300 hover:text-red-500"
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              }`}>
              {following ? <><Check size={14}/> Following</> : <><UserPlus size={14}/> Follow</>}
            </button>
          </div>
        </div>

        {/* Profile info */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">{profile.name}</h1>
            {profile.is_verified && <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-500 rounded-full text-[11px] text-white font-bold">✓</span>}
            {profile.is_private && <Lock size={14} className="text-gray-400"/>}
          </div>
          <p className="text-gray-400 text-sm mb-2">@{profile.username}</p>
          {profile.bio && <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed mb-2">{profile.bio}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mb-3">
            {profile.location && <span className="flex items-center gap-1"><MapPin size={12} className="text-gray-400"/>{profile.location}</span>}
            {profile.website_url && (
              <a href={profile.website_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
                <Link2 size={12}/>{profile.website_label||profile.website_url}
              </a>
            )}
          </div>
          <div className="flex gap-4 text-sm">
            <button onClick={() => navigate(`/profile/${profile.username}/followers`)} className="hover:underline">
              <span className="font-bold text-gray-900 dark:text-white">{(profile.followers_count||0).toLocaleString()}</span>
              <span className="text-gray-500 dark:text-gray-400 ml-1">Followers</span>
            </button>
            <button onClick={() => navigate(`/profile/${profile.username}/followers`)} className="hover:underline">
              <span className="font-bold text-gray-900 dark:text-white">{(profile.following_count||0).toLocaleString()}</span>
              <span className="text-gray-500 dark:text-gray-400 ml-1">Following</span>
            </button>
          </div>
        </div>

        {isPrivateLocked ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Lock size={28} className="text-gray-400"/>
            </div>
            <p className="font-bold text-gray-800 dark:text-white text-lg mb-1">This account is private</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Follow this account to see their quotes.</p>
            <button onClick={handleFollow}
              className="mt-4 bg-blue-600 text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-blue-700">
              Follow to See Quotes
            </button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b border-gray-100 dark:border-gray-800">
              {[
                { id:"quotes",   label:"Quotes",   Icon:FileText },
                { id:"forwards", label:"Forwards", Icon:Repeat2  },
                { id:"media",    label:"Media",    Icon:Grid3X3  },
              ].map(({ id, label, Icon }) => (
                <button key={id} onClick={() => setActiveTab(id as any)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold border-b-2 transition-all ${
                    activeTab===id ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}>
                  <Icon size={14}/>{label}
                </button>
              ))}
            </div>

            {activeTab==="quotes" && (
              postsLoading
                ? <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-400"/></div>
                : quotes.length===0
                ? <div className="flex flex-col items-center justify-center py-16 text-gray-400"><FileText size={40} className="mb-3 text-gray-200 dark:text-gray-700"/><p className="text-sm text-gray-500">No quotes yet</p></div>
                : quotes.map(p => <PostCard key={p.id} post={p} isLoggedIn={true} currentUserId={me?.id}/>)
            )}
            {activeTab==="forwards" && (
              forwards.length===0
                ? <div className="flex flex-col items-center justify-center py-16 text-gray-400"><Repeat2 size={40} className="mb-3 text-gray-200 dark:text-gray-700"/><p className="text-sm text-gray-500">No forwards yet</p></div>
                : forwards.map(p => <PostCard key={p.id} post={p} isLoggedIn={true} currentUserId={me?.id}/>)
            )}
            {activeTab==="media" && (
              <div className="grid grid-cols-3 gap-0.5 p-0.5">
                {quotes.filter(p=>p.mediaItems?.length>0).length===0
                  ? <div className="col-span-3 flex flex-col items-center justify-center py-16 text-gray-400"><Grid3X3 size={40} className="mb-3 text-gray-200 dark:text-gray-700"/><p className="text-sm text-gray-500">No media yet</p></div>
                  : quotes.filter(p=>p.mediaItems?.length>0).map(p => {
                      const first = p.mediaItems[0];
                      return (
                        <div key={p.id} className="aspect-square bg-gray-100 dark:bg-gray-800 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => navigate(`/quote/${p.id}`)}>
                          <img src={first.url} alt="" className="w-full h-full object-cover"/>
                        </div>
                      );
                    })
                }
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

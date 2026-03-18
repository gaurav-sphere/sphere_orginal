import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, UserCheck, Loader2 } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

interface BlockedUser {
  id: string; name: string; username: string; avatar_url: string | null;
}

export function BlockedListPage() {
  const navigate        = useNavigate();
  const { user }        = useAuth();
  const [blocked,       setBlocked]  = useState<BlockedUser[]>([]);
  const [loading,       setLoading]  = useState(true);
  const [unblocking,    setUnblocking] = useState<string | null>(null);
  const [avatarErrors,  setAvatarErrors] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("blocks")
      .select("profiles!blocks_blocked_id_fkey(id, name, username, avatar_url)")
      .eq("blocker_id", user.id);
    setBlocked(((data || []).map((r: any) => r.profiles).filter(Boolean)) as BlockedUser[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const handleUnblock = async (blockedId: string) => {
    if (!user?.id || unblocking) return;
    setUnblocking(blockedId);
    await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", blockedId);
    setBlocked(prev => prev.filter(u => u.id !== blockedId));
    setUnblocking(null);
  };

  return (
    <AppShell>
      <div className="min-h-screen bg-white dark:bg-gray-950">

        {/* Header — no mt-14 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300"/>
          </button>
          <h1 className="font-bold text-gray-900 dark:text-white">Blocked Users</h1>
          {blocked.length > 0 && (
            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{blocked.length} blocked</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-blue-400"/>
          </div>
        ) : blocked.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400 px-6 text-center">
            <UserCheck size={40} className="mb-3 text-gray-200 dark:text-gray-700"/>
            <p className="font-semibold text-gray-600 dark:text-gray-300 mb-1">No blocked users</p>
            <p className="text-sm">People you block will appear here. You can unblock them anytime.</p>
          </div>
        ) : (
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-600 px-4 py-3">
              Blocked users cannot follow you, see your quotes, or message you.
            </p>
            {blocked.map(u => (
              <div key={u.id}
                className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 dark:border-gray-800">
                {/* Avatar */}
                {u.avatar_url && !avatarErrors[u.id] ? (
                  <img src={u.avatar_url} alt={u.name}
                    onError={() => setAvatarErrors(p => ({ ...p, [u.id]: true }))}
                    className="w-11 h-11 rounded-full object-cover shrink-0"/>
                ) : (
                  <div className="w-11 h-11 rounded-full bg-gray-400 dark:bg-gray-600 flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-base">{(u.name||"U")[0].toUpperCase()}</span>
                  </div>
                )}

                {/* Name + username */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{u.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">@{u.username}</p>
                </div>

                {/* Unblock button */}
                <button onClick={() => handleUnblock(u.id)} disabled={unblocking === u.id}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 transition-all disabled:opacity-50">
                  {unblocking === u.id
                    ? <Loader2 size={12} className="animate-spin"/>
                    : <UserCheck size={12}/>}
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Bell, ThumbsUp, MessageCircle, UserPlus,
  RefreshCw, AtSign, Eye, ShieldCheck, Loader2,
} from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

/* ══════════════════════════════════════════════════════════════
   NotificationsPage
   Route: /notifications

   Desktop  — opens inside AppShell (sidebar + header stays).
              Content fills the feed area (promo panel hidden
              since pathname !== /feed).

   Mobile   — AppShell shows header (always, no scroll-hide because
              headerAlwaysVisible = true in AppShell when pathname
              === /notifications). Bottom nav hidden (hideNavOnly).

   Features:
   • Fetches all notifications for current user from DB
   • Marks all as read on page open
   • Realtime: new notifications prepend at top
   • Each type has its own icon + colour
   • Tapping navigates to post or profile
   • Empty state
══════════════════════════════════════════════════════════════ */

interface Notification {
  id:         string;
  type:       string;
  is_read:    boolean;
  created_at: string;
  text?:      string | null;
  post_id?:   string | null;
  actor: { id: string; name: string; username: string; avatar_url: string | null } | null;
}

/* ── Icon + colour per notification type ── */
function notifMeta(type: string): { Icon: React.ElementType; color: string; bg: string } {
  switch (type) {
    case "praise":
      return { Icon: ThumbsUp,    color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-900/40" };
    case "thought":
      return { Icon: MessageCircle, color: "text-blue-500",  bg: "bg-blue-100 dark:bg-blue-900/40"   };
    case "follow":
      return { Icon: UserPlus,    color: "text-green-500",  bg: "bg-green-100 dark:bg-green-900/40"  };
    case "forward":
      return { Icon: RefreshCw,   color: "text-indigo-500", bg: "bg-indigo-100 dark:bg-indigo-900/40"};
    case "mention":
      return { Icon: AtSign,      color: "text-pink-500",   bg: "bg-pink-100 dark:bg-pink-900/40"   };
    case "story_view":
      return { Icon: Eye,         color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-900/40"};
    case "org_verified":
      return { Icon: ShieldCheck, color: "text-blue-600",   bg: "bg-blue-100 dark:bg-blue-900/40"   };
    default:
      return { Icon: Bell,        color: "text-gray-500",   bg: "bg-gray-100 dark:bg-gray-800"       };
  }
}

function notifText(n: Notification): string {
  const who = n.actor?.name || "Someone";
  switch (n.type) {
    case "praise":       return `${who} praised your quote`;
    case "thought":      return `${who} replied to your quote`;
    case "follow":       return `${who} started following you`;
    case "forward":      return `${who} forwarded your quote`;
    case "mention":      return `${who} mentioned you in a quote`;
    case "story_view":   return `${who} viewed your story`;
    case "org_verified": return "Your organisation has been verified ✓";
    default:             return n.text || "New notification";
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function NotificationsPage() {
  const navigate           = useNavigate();
  const { user }           = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading,       setLoading]       = useState(true);

  /* Fetch all notifications */
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("notifications")
      .select(`
        id, type, is_read, created_at, text, post_id,
        actor:profiles!notifications_actor_id_fkey(id, name, username, avatar_url)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) setNotifications(data as unknown as Notification[]);
        setLoading(false);
      });
  }, [user?.id]);

  /* Mark all as read on mount */
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false)
      .then(() => {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      });
  }, [user?.id]);

  /* Realtime — new notifications prepend */
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`notif_page:${user.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, payload => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  /* Tap → navigate */
  const handleTap = (n: Notification) => {
    if (n.post_id)                                     navigate(`/quote/${n.post_id}`);
    else if (n.actor?.id && n.type !== "org_verified") navigate(`/user/${n.actor.id}`);
  };

  return (
    <AppShell>
      <div className="min-h-screen bg-white dark:bg-gray-950">

        {/* ── Page header — no scroll-hide, always visible ── */}
        <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
          <h1 className="font-bold text-gray-900 dark:text-white text-[15px]">Notifications</h1>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-blue-400" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Bell size={28} className="text-gray-300 dark:text-gray-600" />
            </div>
            <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">No notifications yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              When someone praises, replies, or follows you, it'll show up here.
            </p>
          </div>
        ) : (
          <div>
            {notifications.map(n => {
              const { Icon, color, bg } = notifMeta(n.type);
              return (
                <button
                  key={n.id}
                  onClick={() => handleTap(n)}
                  className={`flex items-start gap-3 w-full px-4 py-3.5 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors ${
                    !n.is_read ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
                  }`}
                >
                  {/* Type icon OR actor avatar */}
                  <div className="relative shrink-0 mt-0.5">
                    {n.actor?.avatar_url ? (
                      <>
                        <img src={n.actor.avatar_url} alt={n.actor.name}
                          className="w-10 h-10 rounded-full object-cover" />
                        {/* Small type icon overlay */}
                        <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full ${bg} flex items-center justify-center border-2 border-white dark:border-gray-900`}>
                          <Icon size={10} className={color} />
                        </div>
                      </>
                    ) : (
                      <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center`}>
                        <Icon size={18} className={color} />
                      </div>
                    )}
                  </div>

                  {/* Text + time */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">
                      {notifText(n)}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {timeAgo(n.created_at)}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!n.is_read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1.5" />
                  )}
                </button>
              );
            })}

            {/* Bottom padding */}
            <div className="h-6" />
          </div>
        )}
      </div>
    </AppShell>
  );
}

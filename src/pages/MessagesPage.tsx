import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Search, Send, MoreHorizontal, Image, Ban, X, Loader2, CheckCheck, Check } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

interface Participant {
  id: string;
  name: string;
  username: string;
  avatar_url: string;
}

interface Conversation {
  id: string;
  other: Participant;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  is_read: boolean;
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function msgTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function avatar(url?: string, name?: string) {
  return url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "U")}&background=1D4ED8&color=fff&size=80`;
}

export function MessagesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();

  const [convos, setConvos]         = useState<Conversation[]>([]);
  const [active, setActive]         = useState<Conversation | null>(null);
  const [messages, setMessages]     = useState<Message[]>([]);
  const [query, setQuery]           = useState("");
  const [newMsg, setNewMsg]         = useState("");
  const [loading, setLoading]       = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending]       = useState(false);
  const [showDots, setShowDots]     = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* ── Load conversations ── */
  const loadConvos = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("conversations")
      .select(`
        id, last_message, last_message_at, unread_count,
        participant1_id, participant2_id,
        p1:profiles!conversations_participant1_id_fkey(id,name,username,avatar_url),
        p2:profiles!conversations_participant2_id_fkey(id,name,username,avatar_url)
      `)
      .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false });

    const mapped = (data || []).map((c: any) => {
      const other = c.participant1_id === user.id ? c.p2 : c.p1;
      return {
        id: c.id,
        other: other || { id: "", name: "Unknown", username: "unknown", avatar_url: "" },
        last_message: c.last_message || "",
        last_message_at: c.last_message_at || new Date().toISOString(),
        unread_count: c.unread_count || 0,
      } as Conversation;
    });
    setConvos(mapped);
    setLoading(false);

    // Auto-open from URL param
    const uid = searchParams.get("user");
    if (uid) {
      const found = mapped.find(c => c.other.id === uid || c.other.username === uid);
      if (found) setActive(found);
    }
  }, [user?.id, searchParams]);

  useEffect(() => { loadConvos(); }, [loadConvos]);

  /* ── Load messages ── */
  useEffect(() => {
    if (!active?.id) return;
    setLoadingMsgs(true);
    setMessages([]);

    supabase
      .from("messages")
      .select("id,conversation_id,sender_id,body,created_at,is_read")
      .eq("conversation_id", active.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setMessages((data as Message[]) || []);
        setLoadingMsgs(false);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      });

    // Mark as read
    if (user?.id) {
      supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", active.id)
        .neq("sender_id", user.id)
        .eq("is_read", false)
        .then(() => {
          setConvos(prev => prev.map(c =>
            c.id === active.id ? { ...c, unread_count: 0 } : c
          ));
        });
    }

    // Realtime subscription
    const ch = supabase
      .channel(`msgs-${active.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${active.id}`,
      }, (payload) => {
        const msg = payload.new as Message;
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [active?.id, user?.id]);

  /* ── Send message ── */
  const sendMessage = async () => {
    if (!newMsg.trim() || !active?.id || !user?.id || sending) return;
    const body = newMsg.trim();
    setNewMsg("");
    setSending(true);

    const { data: msg } = await supabase
      .from("messages")
      .insert({ conversation_id: active.id, sender_id: user.id, body })
      .select("id,conversation_id,sender_id,body,created_at,is_read")
      .single();

    if (msg) {
      // update last_message on conversation
      await supabase
        .from("conversations")
        .update({ last_message: body, last_message_at: msg.created_at })
        .eq("id", active.id);

      setConvos(prev => prev.map(c =>
        c.id === active.id
          ? { ...c, last_message: body, last_message_at: msg.created_at }
          : c
      ));
    }
    setSending(false);
  };

  /* ── Block user ── */
  const handleBlock = async () => {
    if (!user?.id || !active) return;
    await supabase.from("blocks").upsert({
      blocker_id: user.id,
      blocked_id: active.other.id,
    });
    setShowDots(false);
    setActive(null);
    loadConvos();
  };

  const filtered = convos.filter(c =>
    !query ||
    c.other.name?.toLowerCase().includes(query.toLowerCase()) ||
    c.other.username?.toLowerCase().includes(query.toLowerCase())
  );

  const myAvatar = profile?.avatar_url || avatar(undefined, profile?.name);

  return (
    <AppShell>
      <div className="flex h-full w-full overflow-hidden">

        {/* ── Conversation list ── */}
        <div className={`${active ? "hidden lg:flex" : "flex"} flex-col w-full lg:w-80 xl:w-96 border-r border-gray-100 bg-white shrink-0`}>

          <div className="px-4 pt-12 pb-3 border-b border-gray-100 bg-white sticky top-0 z-10">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-bold text-gray-900">Messages</h1>
              <button onClick={() => setShowDots(v => !v)} className="p-1 rounded-full hover:bg-gray-100">
                <MoreHorizontal size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2">
              <Search size={14} className="text-gray-400 shrink-0" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search conversations"
                className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={20} className="animate-spin text-blue-500" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <span className="text-4xl mb-2">💬</span>
                <p className="text-sm font-medium">No conversations yet</p>
                <p className="text-xs text-gray-400 mt-1">Follow people to start messaging</p>
              </div>
            ) : (
              filtered.map(convo => (
                <div
                  key={convo.id}
                  onClick={() => setActive(convo)}
                  className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 border-b border-gray-50 transition-colors ${
                    active?.id === convo.id ? "bg-blue-50 border-l-2 border-l-blue-600" : ""
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={avatar(convo.other.avatar_url, convo.other.name)}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900 truncate">{convo.other.name}</span>
                      <span className="text-xs text-gray-400 shrink-0 ml-1">{timeAgo(convo.last_message_at)}</span>
                    </div>
                    <p className={`text-xs truncate mt-0.5 ${convo.unread_count > 0 ? "text-gray-800 font-semibold" : "text-gray-500"}`}>
                      {convo.last_message || "Start a conversation"}
                    </p>
                  </div>
                  {convo.unread_count > 0 && (
                    <div className="w-5 h-5 bg-blue-600 rounded-full text-white text-[10px] flex items-center justify-center font-bold shrink-0">
                      {convo.unread_count > 9 ? "9+" : convo.unread_count}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Chat panel ── */}
        {active ? (
          <div className="flex-1 flex flex-col bg-white min-w-0 overflow-hidden">

            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 pt-12 pb-3 border-b border-gray-100 bg-white shrink-0">
              <button onClick={() => setActive(null)} className="lg:hidden text-gray-500 p-1 -ml-1">
                <ArrowLeft size={20} />
              </button>
              <div className="relative shrink-0 cursor-pointer" onClick={() => navigate(`/user/${active.other.username}`)}>
                <img src={avatar(active.other.avatar_url, active.other.name)} alt="" className="w-9 h-9 rounded-full object-cover" />
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/user/${active.other.username}`)}>
                <p className="text-sm font-bold text-gray-900 truncate">{active.other.name}</p>
                <p className="text-xs text-green-500 font-medium">Online</p>
              </div>
              <button onClick={() => setShowDots(true)} className="p-1 rounded-full hover:bg-gray-100">
                <MoreHorizontal size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {loadingMsgs ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-blue-500" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <span className="text-4xl mb-3">👋</span>
                  <p className="text-sm">Say hi to {active.other.name.split(" ")[0]}!</p>
                </div>
              ) : messages.map(msg => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
                    {!isMe && (
                      <img
                        src={avatar(active.other.avatar_url, active.other.name)}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover shrink-0 mb-0.5"
                      />
                    )}
                    <div className={`max-w-[72%] group`}>
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-snug ${
                        isMe
                          ? "bg-blue-600 text-white rounded-br-sm"
                          : "bg-gray-100 text-gray-900 rounded-bl-sm"
                      }`}>
                        <p>{msg.body}</p>
                      </div>
                      <div className={`flex items-center gap-1 mt-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
                        <span className="text-[10px] text-gray-400">{msgTime(msg.created_at)}</span>
                        {isMe && (
                          msg.is_read
                            ? <CheckCheck size={12} className="text-blue-500" />
                            : <Check size={12} className="text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div className="px-4 py-3 border-t border-gray-100 bg-white shrink-0 flex items-center gap-2">
              <input
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Type a message..."
                className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm outline-none text-gray-800 placeholder-gray-400"
              />
              <button
                onClick={sendMessage}
                disabled={!newMsg.trim() || sending}
                className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center disabled:opacity-40 shrink-0 transition-all hover:bg-blue-700"
              >
                {sending
                  ? <Loader2 size={15} className="animate-spin text-white" />
                  : <Send size={15} className="text-white" />
                }
              </button>
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex flex-1 items-center justify-center bg-gray-50 text-gray-400">
            <div className="text-center">
              <span className="text-6xl">💬</span>
              <p className="mt-4 text-sm font-medium text-gray-500">Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Dots / options sheet ── */}
      {showDots && (
        <>
          <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setShowDots(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl px-4 pb-10 pt-3 sheet-up">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            {active && (
              <button
                onClick={handleBlock}
                className="w-full flex items-center gap-4 py-4 text-sm font-semibold text-red-500 border-b border-gray-100"
              >
                <Ban size={20} /> Block {active.other.name}
              </button>
            )}
            <button
              onClick={() => setShowDots(false)}
              className="w-full flex items-center gap-4 py-4 text-sm font-medium text-gray-400"
            >
              <X size={20} /> Cancel
            </button>
          </div>
        </>
      )}
    </AppShell>
  );
}

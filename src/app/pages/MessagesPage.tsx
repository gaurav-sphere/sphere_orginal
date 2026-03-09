import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Search, Send, MoreHorizontal, Image, Smile, Check, CheckCheck } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { mockUsers, currentUser } from "../mockData";

const CONVERSATIONS = mockUsers.slice(0,4).map((u, i) => ({
  id: u.id,
  user: u,
  lastMsg: ["Hey, great post! 🙌","Did you see that trending topic?","Thanks for the forward!","When are you posting next?"][i],
  time: ["2m","15m","1h","3h"][i],
  unread: [2,0,1,0][i],
  isOwn: [false,true,false,true][i],
}));

const DEMO_MESSAGES = [
  { id:"m1", from:"other", text:"Hey! Great quote about cricket 🏏", time:"10:32 AM", read:true },
  { id:"m2", from:"me",    text:"Thanks so much! Been following the series closely.", time:"10:33 AM", read:true },
  { id:"m3", from:"other", text:"Same! Did you watch the last match?", time:"10:34 AM", read:true },
  { id:"m4", from:"me",    text:"Yes!! What a finish 🔥 Rohit played brilliantly", time:"10:35 AM", read:true },
  { id:"m5", from:"other", text:"Absolutely! Forwarded your quote to my group. They loved it.", time:"10:36 AM", read:false },
];

export function MessagesPage() {
  const navigate = useNavigate();
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState(DEMO_MESSAGES);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeUser = mockUsers.find(u => u.id === activeConv);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeConv]);

  const sendMsg = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { id: `m_${Date.now()}`, from:"me", text:input.trim(), time:"now", read:false }]);
    setInput("");
  };

  const filteredConvs = CONVERSATIONS.filter(c =>
    c.user.name.toLowerCase().includes(search.toLowerCase()) ||
    c.user.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <div className="page-enter mt-14 lg:mt-0 flex h-[calc(100vh-56px)] lg:h-screen bg-white">
        {/* ── Conversation list ── */}
        <div className={`flex flex-col ${activeConv ? "hidden lg:flex" : "flex"} w-full lg:w-80 border-r border-gray-100 shrink-0`}>
          <div className="px-4 py-3 border-b border-gray-100">
            <h1 className="font-bold text-gray-900 text-lg mb-3">Messages</h1>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search messages"
                className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 text-gray-900" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredConvs.map((conv) => (
              <button key={conv.id} onClick={() => setActiveConv(conv.id)}
                className={`flex items-center gap-3 w-full px-4 py-3.5 hover:bg-gray-50 transition-colors border-b border-gray-50 text-left ${activeConv===conv.id?"bg-blue-50/50":""}`}>
                <div className="relative shrink-0">
                  <img src={conv.user.avatar} alt={conv.user.name} className="w-12 h-12 rounded-full object-cover" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="font-bold text-gray-900 text-sm truncate">{conv.user.name}</p>
                    <span className="text-xs text-gray-400 shrink-0 ml-2">{conv.time}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`text-xs truncate ${conv.unread > 0 ? "font-semibold text-gray-800" : "text-gray-500"}`}>
                      {conv.isOwn && <span className="text-gray-400">You: </span>}{conv.lastMsg}
                    </p>
                    {conv.unread > 0 && (
                      <span className="ml-2 w-5 h-5 bg-blue-600 rounded-full text-[10px] text-white font-bold flex items-center justify-center shrink-0">{conv.unread}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Chat thread ── */}
        {activeConv ? (
          <div className="flex-1 flex flex-col">
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
              <button onClick={() => setActiveConv(null)} className="lg:hidden w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
                <ArrowLeft size={20} className="text-gray-700" />
              </button>
              <img src={activeUser?.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-sm">{activeUser?.name}</p>
                <p className="text-xs text-green-500 font-medium">Active now</p>
              </div>
              <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
                <MoreHorizontal size={18} className="text-gray-600" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.from==="me"?"justify-end":"justify-start"}`}>
                  <div className={`max-w-[75%] ${m.from==="me"?"":"flex gap-2 items-end"}`}>
                    {m.from==="other" && <img src={activeUser?.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0 mb-0.5" />}
                    <div>
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        m.from==="me"
                          ? "bg-blue-600 text-white rounded-br-sm"
                          : "bg-gray-100 text-gray-900 rounded-bl-sm"
                      }`}>
                        {m.text}
                      </div>
                      <div className={`flex items-center gap-1 mt-0.5 ${m.from==="me"?"justify-end":""}`}>
                        <span className="text-[10px] text-gray-400">{m.time}</span>
                        {m.from==="me" && (m.read ? <CheckCheck size={11} className="text-blue-500" /> : <Check size={11} className="text-gray-400" />)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-white">
              <button className="w-9 h-9 rounded-full flex items-center justify-center text-blue-500 hover:bg-blue-50 transition-colors">
                <Image size={20} />
              </button>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key==="Enter" && sendMsg()}
                placeholder="Message…"
                className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 text-gray-900" />
              <button onClick={sendMsg} disabled={!input.trim()}
                className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center disabled:opacity-40 hover:bg-blue-700 transition-colors">
                <Send size={15} className="text-white ml-0.5" />
              </button>
            </div>
          </div>
        ) : (
          /* Empty state on desktop */
          <div className="hidden lg:flex flex-1 items-center justify-center text-gray-400 flex-col gap-3">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
              <Send size={28} className="text-blue-400" />
            </div>
            <p className="font-semibold text-gray-600">Select a conversation</p>
            <p className="text-sm">Choose a chat from the list to start messaging</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

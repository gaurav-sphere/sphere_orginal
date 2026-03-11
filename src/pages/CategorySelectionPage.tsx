import React, { useState } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, Check } from "lucide-react";
import { useGuest } from "../contexts/GuestContext";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

const LANGS = [
  { id: "en", label: "English",  flag: "🇬🇧" },
  { id: "hi", label: "Hindi",    flag: "🇮🇳" },
  { id: "te", label: "Telugu",   flag: "🇮🇳" },
  { id: "ta", label: "Tamil",    flag: "🇮🇳" },
  { id: "kn", label: "Kannada",  flag: "🇮🇳" },
  { id: "bn", label: "Bengali",  flag: "🇮🇳" },
  { id: "or", label: "Odia",     flag: "🇮🇳" },
  { id: "mr", label: "Marathi",  flag: "🇮🇳" },
  { id: "pa", label: "Punjabi",  flag: "🇮🇳" },
];

const CATEGORIES = [
  { id: "technology",   label: "Technology",   icon: "💻" },
  { id: "cricket",      label: "Cricket",       icon: "🏏" },
  { id: "bollywood",    label: "Bollywood",     icon: "🎬" },
  { id: "science",      label: "Science",       icon: "🔬" },
  { id: "politics",     label: "Politics",      icon: "🏛️" },
  { id: "music",        label: "Music",         icon: "🎵" },
  { id: "sports",       label: "Sports",        icon: "🏅" },
  { id: "travel",       label: "Travel",        icon: "✈️" },
  { id: "food",         label: "Food",          icon: "🍜" },
  { id: "gaming",       label: "Gaming",        icon: "🎮" },
  { id: "finance",      label: "Finance",       icon: "📈" },
  { id: "fitness",      label: "Fitness",       icon: "💪" },
  { id: "art",          label: "Art",           icon: "🎨" },
  { id: "environment",  label: "Environment",   icon: "🌿" },
  { id: "education",    label: "Education",     icon: "📚" },
  { id: "fashion",      label: "Fashion",       icon: "👗" },
  { id: "comedy",       label: "Comedy",        icon: "😂" },
  { id: "business",     label: "Business",      icon: "💼" },
  { id: "news",         label: "News",          icon: "📰" },
  { id: "spirituality", label: "Spiritual",     icon: "🧘" },
];

export function CategorySelectionPage() {
  const navigate = useNavigate();
  const { getTopInterests } = useGuest();
  const { user, saveLanguages } = useAuth();

  const topInterests = getTopInterests().map(i => i.tag);
  const defaultSelected = CATEGORIES
    .filter(c => topInterests.includes(c.label.toLowerCase()))
    .map(c => c.id).slice(0, 5);

  const [selected, setSelected]       = useState<string[]>(defaultSelected.length >= 3 ? defaultSelected : []);
  const [selectedLangs, setSelectedLangs] = useState<string[]>(["en"]);
  const [saving, setSaving]           = useState(false);

  const toggle = (id: string) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleLang = (id: string) => setSelectedLangs(p => p.includes(id) ? (p.length > 1 ? p.filter(x => x !== id) : p) : [...p, id]);

  const canContinue = selected.length >= 3;
  const remaining   = Math.max(0, 3 - selected.length);

  const handleContinue = async () => {
    if (!canContinue || saving) return;
    setSaving(true);
    if (user?.id) {
      try {
        await supabase.from("profiles")
          .update({ language: selectedLangs, updated_at: new Date().toISOString() })
          .eq("id", user.id);
        if (selected.length > 0) {
          await supabase.from("user_categories").delete().eq("user_id", user.id);
          await supabase.from("user_categories").insert(selected.map(cat => ({ user_id: user.id, category: cat })));
        }
        if (saveLanguages) await saveLanguages(selectedLangs);
      } catch { /* non-fatal */ }
    }
    setSaving(false);
    navigate("/feed");
  };

  return (
    <div className="bg-white flex flex-col" style={{ height: "100dvh", overflow: "hidden" }}>
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <p className="font-sphere text-xl text-blue-600">sphere</p>
          <p className="text-[10px] text-gray-400">{selected.length} selected · {selectedLangs.length} language{selectedLangs.length !== 1 ? "s" : ""}</p>
        </div>
        <p className="text-xs text-gray-500 mb-2">Personalise your feed</p>
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, (selected.length / 3) * 100)}%` }} />
        </div>
      </div>

      {/* Scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="mb-3">
          <h1 className="text-base font-extrabold text-gray-900">What are you into? 🎯</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Pick at least 3 topics</p>
        </div>

        {/* Categories — 4 col grid, uniform icon size, transparent when unselected */}
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mb-5">
          {CATEGORIES.map(cat => {
            const isSel = selected.includes(cat.id);
            return (
              <button key={cat.id} onClick={() => toggle(cat.id)}
                className={`relative flex flex-col items-center gap-1 p-2.5 rounded-2xl border-2 transition-all active:scale-95 ${
                  isSel ? "border-blue-500 bg-blue-50" : "border-gray-100 bg-gray-50 hover:border-gray-200"
                }`}>
                {isSel && (
                  <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-blue-600 rounded-full flex items-center justify-center">
                    <Check size={8} className="text-white" />
                  </div>
                )}
                <span className="text-2xl leading-none" style={{ opacity: isSel ? 1 : 0.45 }}>
                  {cat.icon}
                </span>
                <span className={`text-[9px] font-bold text-center leading-tight ${isSel ? "text-blue-700" : "text-gray-500"}`}>
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Languages */}
        <div className="mb-4">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">🗣️ Languages</p>
          <div className="grid grid-cols-2 gap-1.5">
            {LANGS.map(l => (
              <button key={l.id} onClick={() => toggleLang(l.id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-full border-2 text-xs font-semibold transition-all ${
                  selectedLangs.includes(l.id)
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200"
                }`}>
                <span>{l.flag}</span>
                {l.label}
                {selectedLangs.includes(l.id) && <Check size={10} className="ml-auto text-blue-600" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Fixed CTA */}
      <div className="flex-shrink-0 px-4 py-4 border-t border-gray-100 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <button onClick={handleContinue} disabled={!canContinue || saving}
          className="w-full py-3.5 bg-blue-600 text-white rounded-full font-bold text-sm hover:bg-blue-700 disabled:opacity-40 transition-all shadow-md shadow-blue-200/50 flex items-center justify-center gap-2">
          {saving ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Saving…
            </>
          ) : <>Continue to Sphere <ChevronRight size={15} /></>}
        </button>
        {!canContinue && (
          <p className="text-[11px] text-gray-400 text-center mt-1.5">
            Select {remaining} more topic{remaining !== 1 ? "s" : ""} to continue
          </p>
        )}
      </div>
    </div>
  );
}

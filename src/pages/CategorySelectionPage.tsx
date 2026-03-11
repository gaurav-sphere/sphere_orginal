import React, { useState } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, ChevronDown, Check } from "lucide-react";
import { useGuest } from "../contexts/GuestContext";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

/* ── Language list ── */
const LANGS = [
  { id: "en", label: "English",  flag: "🇬🇧", script: "Aa"  },
  { id: "hi", label: "Hindi",    flag: "🇮🇳", script: "हिं" },
  { id: "te", label: "Telugu",   flag: "🇮🇳", script: "తె"  },
  { id: "ta", label: "Tamil",    flag: "🇮🇳", script: "த"   },
  { id: "kn", label: "Kannada",  flag: "🇮🇳", script: "ಕ"   },
  { id: "bn", label: "Bengali",  flag: "🇮🇳", script: "বাং" },
  { id: "or", label: "Odia",     flag: "🇮🇳", script: "ଓ"   },
  { id: "mr", label: "Marathi",  flag: "🇮🇳", script: "म"   },
  { id: "pa", label: "Punjabi",  flag: "🇮🇳", script: "ਪੰ"  },
];

/* ── Categories with sub-categories (2-3 each) ── */
interface Category {
  id: string;
  label: string;
  icon: string;          // emoji — rendered transparent-style
  subs?: { id: string; label: string }[];
}

const CATEGORIES: Category[] = [
  { id: "technology", label: "Technology", icon: "💻",
    subs: [{ id: "smartphones", label: "Smartphones" }, { id: "pc", label: "PC / Laptops" }, { id: "ai", label: "AI & Gadgets" }] },
  { id: "cricket",   label: "Cricket",    icon: "🏏",
    subs: [{ id: "ipl", label: "IPL" }, { id: "t20", label: "T20 World Cup" }, { id: "test", label: "Test Cricket" }] },
  { id: "bollywood", label: "Bollywood",  icon: "🎬",
    subs: [{ id: "movies", label: "Movies" }, { id: "celebs", label: "Celebs" }, { id: "music_b", label: "Film Music" }] },
  { id: "science",   label: "Science",    icon: "🔬",
    subs: [{ id: "space", label: "Space" }, { id: "biology", label: "Biology" }, { id: "climate", label: "Climate" }] },
  { id: "politics",  label: "Politics",   icon: "🏛️",
    subs: [{ id: "india_pol", label: "India" }, { id: "world_pol", label: "World" }, { id: "elections", label: "Elections" }] },
  { id: "music",     label: "Music",      icon: "🎵",
    subs: [{ id: "indie", label: "Indie" }, { id: "classical", label: "Classical" }, { id: "hiphop", label: "Hip-Hop" }] },
  { id: "sports",    label: "Sports",     icon: "🏅",
    subs: [{ id: "football", label: "Football" }, { id: "badminton", label: "Badminton" }, { id: "kabaddi", label: "Kabaddi" }] },
  { id: "travel",    label: "Travel",     icon: "✈️",
    subs: [{ id: "domestic", label: "India Travel" }, { id: "international", label: "International" }, { id: "trekking", label: "Trekking" }] },
  { id: "food",      label: "Food",       icon: "🍜",
    subs: [{ id: "recipes", label: "Recipes" }, { id: "streetfood", label: "Street Food" }, { id: "health_food", label: "Healthy Eating" }] },
  { id: "gaming",    label: "Gaming",     icon: "🎮",
    subs: [{ id: "mobile_game", label: "Mobile Gaming" }, { id: "esports", label: "eSports" }, { id: "console", label: "Console" }] },
  { id: "finance",   label: "Finance",    icon: "📈",
    subs: [{ id: "stocks", label: "Stocks" }, { id: "crypto", label: "Crypto" }, { id: "personal_fin", label: "Personal Finance" }] },
  { id: "fitness",   label: "Fitness",    icon: "💪",
    subs: [{ id: "yoga", label: "Yoga" }, { id: "gym", label: "Gym" }, { id: "running", label: "Running" }] },
  { id: "art",       label: "Art",        icon: "🎨",
    subs: [{ id: "digital_art", label: "Digital Art" }, { id: "photography", label: "Photography" }, { id: "painting", label: "Painting" }] },
  { id: "environment", label: "Environment", icon: "🌿",
    subs: [{ id: "sustainability", label: "Sustainability" }, { id: "wildlife", label: "Wildlife" }] },
  { id: "education", label: "Education",  icon: "📚",
    subs: [{ id: "exams", label: "Exams & Jobs" }, { id: "college", label: "College Life" }, { id: "skills", label: "Skills" }] },
  { id: "fashion",   label: "Fashion",    icon: "👗",
    subs: [{ id: "style", label: "Style" }, { id: "beauty", label: "Beauty" }, { id: "streetwear", label: "Streetwear" }] },
  { id: "comedy",    label: "Comedy",     icon: "😂",
    subs: [{ id: "memes", label: "Memes" }, { id: "standup", label: "Stand-up" }] },
  { id: "business",  label: "Business",   icon: "💼",
    subs: [{ id: "startups", label: "Startups" }, { id: "entrepreneurs", label: "Entrepreneurs" }, { id: "remote", label: "Remote Work" }] },
  { id: "news",      label: "News",       icon: "📰",
    subs: [{ id: "india_news", label: "India" }, { id: "world_news", label: "World" }, { id: "tech_news", label: "Tech News" }] },
  { id: "spirituality", label: "Spirituality", icon: "🧘",
    subs: [{ id: "meditation", label: "Meditation" }, { id: "religion", label: "Religion" }] },
];

/* ── Category Card ── */
function CategoryCard({
  cat,
  selected,
  expanded,
  selectedSubs,
  onToggle,
  onToggleExpand,
  onToggleSub,
}: {
  cat: Category;
  selected: boolean;
  expanded: boolean;
  selectedSubs: string[];
  onToggle: () => void;
  onToggleExpand: () => void;
  onToggleSub: (id: string) => void;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={`relative w-full flex flex-col items-center gap-1 p-2.5 rounded-2xl border-2 transition-all ${
          selected
            ? "border-blue-500 bg-blue-50"
            : "border-gray-100 bg-gray-50 hover:border-gray-200"
        }`}
      >
        {selected && (
          <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
            <Check size={9} className="text-white" />
          </div>
        )}
        {/* Transparent icon: emoji shown with opacity */}
        <span
          className="text-lg leading-none"
          style={{ filter: selected ? "none" : "opacity(0.55) grayscale(20%)" }}
        >
          {cat.icon}
        </span>
        <span className={`text-[10px] font-bold text-center leading-tight ${
          selected ? "text-blue-700" : "text-gray-600"
        }`}>
          {cat.label}
        </span>
      </button>

      {/* Sub-categories — expand button below card when selected */}
      {selected && cat.subs && cat.subs.length > 0 && (
        <div className="mt-1">
          <button
            onClick={onToggleExpand}
            className="w-full flex items-center justify-center gap-0.5 text-[9px] text-blue-500 font-bold py-0.5"
          >
            {expanded ? "Less" : "More"}
            <ChevronDown size={9} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
          {expanded && (
            <div className="flex flex-wrap gap-1 mt-1 justify-center">
              {cat.subs.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => onToggleSub(sub.id)}
                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold border transition-all ${
                    selectedSubs.includes(sub.id)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════ */
export function CategorySelectionPage() {
  const navigate  = useNavigate();
  const { getTopInterests } = useGuest();
  const { user, saveLanguages } = useAuth();

  const topInterests = getTopInterests().map((i) => i.tag);

  // Pre-select from cookie interests
  const defaultSelected = CATEGORIES
    .filter((c) => topInterests.includes(c.label.toLowerCase()))
    .map((c) => c.id)
    .slice(0, 5);

  const [selected, setSelected]       = useState<string[]>(defaultSelected.length >= 3 ? defaultSelected : []);
  const [selectedSubs, setSelectedSubs] = useState<string[]>([]);
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [selectedLangs, setSelectedLangs] = useState<string[]>(["en"]);
  const [saving, setSaving]           = useState(false);

  const toggle = (id: string) =>
    setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const toggleSub = (id: string) =>
    setSelectedSubs((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const toggleLang = (id: string) =>
    setSelectedLangs((p) =>
      p.includes(id) ? (p.length > 1 ? p.filter((x) => x !== id) : p) : [...p, id]
    );

  const canContinue = selected.length >= 3;

  const handleContinue = async () => {
    if (!canContinue) return;
    setSaving(true);

    // Save categories + sub-categories + languages to the user profile
    if (user?.id) {
      const allCategories = [...selected, ...selectedSubs];
      try {
        await supabase
          .from('profiles')
          .update({
            language:    selectedLangs,
            // store selected categories in user_categories junction (if table exists)
            // or as metadata field
            updated_at:  new Date().toISOString(),
          })
          .eq('id', user.id);

        // Also try to save to user_categories table if it exists
        if (allCategories.length > 0) {
          await supabase
            .from('user_categories')
            .delete()
            .eq('user_id', user.id);

          await supabase
            .from('user_categories')
            .insert(allCategories.map((cat) => ({ user_id: user.id, category: cat })));
        }
      } catch {
        // Non-fatal — proceed to feed regardless
      }

      // Save languages specifically
      if (saveLanguages) await saveLanguages(selectedLangs);
    }

    setSaving(false);
    navigate("/feed");
  };

  const remaining = 3 - selected.length;

  return (
    <div
      className="bg-white flex flex-col"
      style={{ height: "100dvh", overflow: "hidden" }}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <p className="font-sphere text-xl text-blue-600">sphere</p>
          <p className="text-[10px] text-gray-400 font-medium">
            {selected.length} cats · {selectedLangs.length} lang{selectedLangs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <p className="text-xs text-gray-500 mb-2">Personalise your feed — takes only a moment</p>
        {/* Progress */}
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, (selected.length / 3) * 100)}%` }}
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {/* Categories heading */}
        <div className="mb-2 mt-1">
          <h1 className="text-base font-extrabold text-gray-900 flex items-center gap-1.5">
            What are you into? 🎯
          </h1>
          <p className="text-[11px] text-gray-500">Pick at least 3 topics</p>
        </div>

        {/* Category grid — 4 cols on mobile, 5 on tablet */}
        <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-1.5 mb-5">
          {CATEGORIES.map((cat) => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              selected={selected.includes(cat.id)}
              expanded={expanded === cat.id}
              selectedSubs={selectedSubs}
              onToggle={() => toggle(cat.id)}
              onToggleExpand={() => setExpanded((e) => (e === cat.id ? null : cat.id))}
              onToggleSub={toggleSub}
            />
          ))}
        </div>

        {/* Languages */}
        <div className="mb-4">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2.5">
            🗣️ Pick your languages
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {LANGS.map((l) => (
              <button
                key={l.id}
                onClick={() => toggleLang(l.id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-full border-2 text-xs font-semibold transition-all ${
                  selectedLangs.includes(l.id)
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200"
                }`}
              >
                <span>{l.flag}</span>
                <span className="font-bold text-[10px] text-gray-400">{l.script}</span>
                {l.label}
                {selectedLangs.includes(l.id) && (
                  <Check size={11} className="ml-auto text-blue-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Fixed CTA */}
      <div className="flex-shrink-0 px-4 py-4 border-t border-gray-100 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <button
          onClick={handleContinue}
          disabled={!canContinue || saving}
          className="w-full py-3.5 bg-blue-600 text-white rounded-full font-bold text-sm hover:bg-blue-700 disabled:opacity-40 transition-all shadow-md shadow-blue-200/50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Saving…
            </>
          ) : (
            <>Continue to Sphere <ChevronRight size={16} /></>
          )}
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

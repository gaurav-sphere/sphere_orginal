import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Check, ChevronRight } from "lucide-react";
import { suggestedCategories } from "../mockData";
import { useGuest } from "../../contexts/GuestContext";

const LANGS = [
  { id:"en", label:"English", script:"Aa" },
  { id:"hi", label:"Hindi", script:"हिं" },
  { id:"te", label:"Telugu", script:"తె" },
  { id:"ta", label:"Tamil", script:"த" },
  { id:"kn", label:"Kannada", script:"ಕ" },
  { id:"bn", label:"Bengali", script:"বাং" },
  { id:"or", label:"Odia", script:"ଓ" },
  { id:"mr", label:"Marathi", script:"म" },
  { id:"pa", label:"Punjabi", script:"ਪੰ" },
];

export function CategorySelectionPage() {
  const navigate = useNavigate();
  const { getTopInterests } = useGuest();
  const topInterests = getTopInterests().map(i => i.tag);

  // Pre-select from cookie interests
  const defaultSelected = suggestedCategories
    .filter(c => topInterests.includes(c.label.toLowerCase()))
    .map(c => c.id)
    .slice(0, 5);

  const [selected, setSelected] = useState<string[]>(defaultSelected.length >= 3 ? defaultSelected : []);
  const [selectedLangs, setSelectedLangs] = useState<string[]>(["en"]);
  const hasCookiePrefill = defaultSelected.length >= 3;

  const toggle = (id: string) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleLang = (id: string) => setSelectedLangs(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const canContinue = selected.length >= 3;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="px-4 pt-10 pb-4 text-center">
        <p className="font-sphere text-3xl text-blue-600 mb-2">sphere</p>
        <h1 className="text-xl font-extrabold text-gray-900 mb-1">What interests you?</h1>
        <p className="text-sm text-gray-500">Pick at least 3 topics to personalise your feed</p>
        {hasCookiePrefill && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-xs font-semibold">
            ✨ Based on what you've been reading — pre-selected for you!
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="px-6 mb-2">
        <div className="h-1.5 bg-gray-100 rounded-full">
          <div className="h-1.5 bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, (selected.length / 3) * 100)}%` }} />
        </div>
        <p className="text-xs text-gray-400 mt-1 text-right">{selected.length} selected (min 3)</p>
      </div>

      {/* Categories */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {suggestedCategories.map((cat) => {
            const isSelected = selected.includes(cat.id);
            const isPreferred = hasCookiePrefill && defaultSelected.includes(cat.id);
            return (
              <button key={cat.id} onClick={() => toggle(cat.id)}
                className={`relative flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                  isSelected
                    ? "border-blue-600 bg-blue-50 shadow-sm"
                    : "border-gray-100 bg-gray-50 hover:border-gray-200"
                }`}>
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                    <Check size={10} className="text-white" />
                  </div>
                )}
                {isPreferred && !isSelected && (
                  <div className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-green-400" />
                )}
                <span className="text-xl">{cat.icon}</span>
                <span className={`text-[11px] font-bold text-center leading-tight ${isSelected ? "text-blue-700" : "text-gray-700"}`}>
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Languages */}
      <div className="px-4 pb-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Languages</p>
        <div className="flex flex-wrap gap-2">
          {LANGS.map(l => (
            <button key={l.id} onClick={() => toggleLang(l.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                selectedLangs.includes(l.id)
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200"
              }`}>
              <span className="font-bold text-xs">{l.script}</span> {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 pb-10 mt-auto">
        <button onClick={() => navigate("/feed")} disabled={!canContinue}
          className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
          Continue to Sphere <ChevronRight size={16} />
        </button>
        {!canContinue && <p className="text-xs text-gray-400 text-center mt-2">Select {3 - selected.length} more topic{3 - selected.length !== 1 ? "s" : ""} to continue</p>}
      </div>
    </div>
  );
}

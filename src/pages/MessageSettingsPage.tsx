import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Check, Loader2, Shield, Users, Globe } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

/*
  MessageSettingsPage  —  /messages/settings

  Saves dm_pref to profiles.dm_pref column.
  Run this SQL first if the column doesn't exist:
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dm_pref text DEFAULT 'everyone'
      CHECK (dm_pref IN ('everyone','followers','nobody'));
*/

const OPTIONS = [
  {
    value:   "everyone",
    label:   "Everyone",
    desc:    "Anyone on Sphere can send you a DM",
    Icon:    Globe,
    color:   "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    value:   "followers",
    label:   "People I Follow",
    desc:    "Only people you follow can message you",
    Icon:    Users,
    color:   "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/30",
  },
  {
    value:   "nobody",
    label:   "Nobody",
    desc:    "Turn off all incoming DMs",
    Icon:    Shield,
    color:   "text-red-500 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/20",
  },
];

export function MessageSettingsPage() {
  const navigate          = useNavigate();
  const { user, profile } = useAuth();
  const [pref,    setPref]    = useState<string>("everyone");
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  /* Load current preference from profile */
  useEffect(() => {
    if ((profile as any)?.dm_pref) {
      setPref((profile as any).dm_pref);
    }
  }, [profile]);

  const handleSave = async (value: string) => {
    if (!user?.id || value === pref) { setPref(value); return; }
    setPref(value);
    setSaving(true);
    const { error } = await supabase.from("profiles")
      .update({ dm_pref: value, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    setSaving(false);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  };

  return (
    <AppShell>
      <div className="min-h-full bg-white dark:bg-gray-950">
        {/* Header — no mt-14 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="font-bold text-gray-900 dark:text-white flex-1">Message Settings</h1>
          {saving && <Loader2 size={16} className="animate-spin text-blue-400" />}
          {saved  && <span className="text-xs text-green-500 font-semibold">Saved ✓</span>}
        </div>

        <div className="px-4 py-5 max-w-lg">
          <p className="text-xs font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-4">
            Who can send you DMs?
          </p>

          <div className="space-y-3">
            {OPTIONS.map(({ value, label, desc, Icon, color, bgColor }) => {
              const active = pref === value;
              return (
                <button key={value} onClick={() => handleSave(value)}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl border-2 text-left transition-all ${
                    active
                      ? `border-blue-500 ${bgColor}`
                      : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700"
                  }`}>
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${active ? bgColor : "bg-gray-50 dark:bg-gray-800"}`}>
                    <Icon size={20} className={active ? color : "text-gray-400 dark:text-gray-500"} />
                  </div>

                  {/* Label + desc */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${active ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"}`}>
                      {label}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">{desc}</p>
                  </div>

                  {/* Radio dot */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    active ? "border-blue-600 bg-blue-600" : "border-gray-300 dark:border-gray-600"
                  }`}>
                    {active && <Check size={11} className="text-white" strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-600 mt-5 leading-relaxed px-1">
            This setting only affects new messages. Existing conversations are not affected.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

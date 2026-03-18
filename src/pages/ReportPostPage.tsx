import React, { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

const REASONS = [
  "Spam or misleading",
  "Harassment or bullying",
  "Hate speech or discrimination",
  "Misinformation",
  "Nudity or sexual content",
  "Violence or dangerous content",
  "Copyright violation",
  "Other",
];

export function ReportPostPage() {
  const navigate     = useNavigate();
  const { id }       = useParams<{ id: string }>();
  const { user }     = useAuth();

  const [selected,   setSelected]   = useState("");
  const [details,    setDetails]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [error,      setError]      = useState("");

  /*
    The `id` param can be a post ID or "user_<userId>".
    We detect which type it is and build the insert accordingly.
  */
  const isUserReport = id?.startsWith("user_");
  const reportedUserId = isUserReport ? id?.replace("user_", "") : undefined;
  const reportedPostId = !isUserReport ? id : undefined;

  const submit = async () => {
    if (!selected || !user?.id) return;
    setSubmitting(true); setError("");

    const { error: dbErr } = await supabase.from("reports").insert({
      reporter_id: user.id,
      post_id:     reportedPostId || null,
      user_id:     reportedUserId || null,
      reason:      selected,
      details:     details.trim() || null,
      status:      "pending",
    });

    setSubmitting(false);
    if (dbErr) { setError("Failed to submit. Please try again."); return; }

    setSubmitted(true);
    setTimeout(() => navigate(-1), 2500);
  };

  return (
    <AppShell>
      <div className="min-h-screen bg-white dark:bg-gray-950">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300"/>
          </button>
          <h1 className="font-bold text-gray-900 dark:text-white">
            {isUserReport ? "Report User" : "Report Quote"}
          </h1>
        </div>

        {submitted ? (
          /* Success state */
          <div className="flex flex-col items-center justify-center py-32 gap-4 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/50 flex items-center justify-center">
              <Check size={30} className="text-green-500"/>
            </div>
            <p className="font-bold text-gray-900 dark:text-white text-lg">Report Submitted</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
              Thanks for helping keep Sphere safe. We'll review this report soon and take appropriate action.
            </p>
          </div>
        ) : (
          <div className="px-4 py-5 space-y-5 max-w-lg">

            <p className="text-sm text-gray-600 dark:text-gray-400">
              Why are you reporting this {isUserReport ? "account" : "quote"}?
            </p>

            {error && (
              <div className="px-4 py-3 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 rounded-xl text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Reason list */}
            <div className="space-y-2">
              {REASONS.map(r => (
                <button key={r} onClick={() => setSelected(r)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 text-sm font-semibold text-left transition-all ${
                    selected === r
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                      : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 text-gray-800 dark:text-gray-200"
                  }`}>
                  {r}
                  {selected === r && (
                    <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                      <Check size={12} className="text-white"/>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Details */}
            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">
                Additional details <span className="text-gray-300 dark:text-gray-600 font-normal">(optional)</span>
              </label>
              <textarea value={details} onChange={e => setDetails(e.target.value.slice(0, 500))} rows={3}
                placeholder="Tell us more about the issue…"
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 resize-none text-gray-900 dark:text-white placeholder-gray-400"/>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1 text-right">{details.length}/500</p>
            </div>

            <button onClick={submit} disabled={!selected || submitting}
              className="w-full py-3 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
              {submitting ? <><Loader2 size={15} className="animate-spin"/> Submitting…</> : "Submit Report"}
            </button>

            <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
              False reports may result in action on your account.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

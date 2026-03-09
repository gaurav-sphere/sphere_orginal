import React, { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Check } from "lucide-react";

const REASONS = ["Spam or misleading","Harassment or bullying","Hate speech or discrimination","Misinformation","Nudity or sexual content","Violence or dangerous content","Other"];

export function ReportPostPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [selected, setSelected] = useState("");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = () => { if (!selected) return; setSubmitted(true); setTimeout(() => navigate(-1), 2000); };

  return (
    <div className="min-h-screen bg-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900">Report Quote</h1>
      </div>
      {submitted ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center"><Check size={30} className="text-green-500" /></div>
          <p className="font-bold text-gray-900 text-lg">Report Submitted</p>
          <p className="text-sm text-gray-500 text-center px-8">Thanks for helping keep Sphere safe. We'll review this report soon.</p>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-4">
          <p className="text-sm text-gray-600">Why are you reporting this quote?</p>
          <div className="space-y-2">
            {REASONS.map(r => (
              <button key={r} onClick={() => setSelected(r)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 text-sm font-semibold text-left transition-all ${selected===r?"border-blue-600 bg-blue-50 text-blue-700":"border-gray-100 hover:border-gray-200 text-gray-800"}`}>
                {r}
                {selected===r && <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center"><Check size={12} className="text-white" /></div>}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Additional details (optional)</label>
            <textarea value={details} onChange={e => setDetails(e.target.value)} rows={3}
              placeholder="Tell us more…"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none text-gray-900" />
          </div>
          <button onClick={submit} disabled={!selected}
            className="w-full py-3 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 disabled:opacity-40 transition-all">
            Submit Report
          </button>
        </div>
      )}
    </div>
  );
}

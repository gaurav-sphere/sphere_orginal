import React, { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabase";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail]     = useState("");
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");

  const handle = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.includes("@")) { setErr("Please enter a valid email address"); return; }
    setLoading(true); setErr("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) setErr(error.message);
    else setSent(true);
  };

  const inputCls =
    "w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-full text-sm " +
    "focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 " +
    "transition-all text-gray-900 placeholder-gray-400";

  return (
    <div
      className="bg-white flex flex-col"
      style={{ height: "100dvh", overflow: "hidden" }}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={18} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900 text-sm">Reset Password</h1>
      </div>

      {/* Content — shifted UP by using pt-8 instead of centering */}
      <div className="flex-1 overflow-y-auto px-6 pt-8">
        <div className="max-w-xs mx-auto">
          {/* Icon */}
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5 ${
            sent ? "bg-green-50" : "bg-blue-50"
          }`}>
            {sent
              ? <CheckCircle2 size={28} className="text-green-500" />
              : <Mail size={26} className="text-blue-600" />
            }
          </div>

          {sent ? (
            <div className="text-center">
              <h2 className="font-extrabold text-gray-900 text-xl mb-2">Check your email</h2>
              <p className="text-sm text-gray-500 mb-1">We sent a reset link to</p>
              <p className="text-sm font-bold text-gray-900 mb-6 break-all">{email}</p>
              <p className="text-xs text-gray-400 mb-8">
                Can't find it? Check your spam folder.
              </p>
              <button
                onClick={() => navigate("/login")}
                className="w-full py-3.5 bg-blue-600 text-white rounded-full font-bold text-sm hover:bg-blue-700 transition-all shadow-md shadow-blue-200/50"
              >
                Back to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handle} className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="font-extrabold text-gray-900 text-xl">Forgot your password?</h2>
                <p className="text-xs text-gray-500 mt-1.5">
                  Enter your email and we'll send you a reset link.
                </p>
              </div>

              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handle()}
                  placeholder="your@email.com"
                  className={inputCls}
                  autoComplete="email"
                />
              </div>

              {err && (
                <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                  <p className="text-red-600 text-xs font-medium">{err}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email.includes("@")}
                className="w-full py-3.5 bg-blue-600 text-white rounded-full font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md shadow-blue-200/50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Sending…
                  </>
                ) : "Send Reset Link"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Mail, Check } from "lucide-react";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setLoading(false); setSent(true);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-gray-900">Reset Password</h1>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
          {sent ? <Check size={30} className="text-green-500" /> : <Mail size={30} className="text-blue-600" />}
        </div>
        {sent ? (
          <div className="text-center">
            <h2 className="font-bold text-gray-900 text-lg mb-2">Check your email</h2>
            <p className="text-sm text-gray-500 mb-6">We sent a reset link to <strong>{email}</strong></p>
            <button onClick={() => navigate("/login")} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors">
              Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handle} className="w-full max-w-sm space-y-4">
            <div className="text-center mb-2">
              <h2 className="font-bold text-gray-900 text-lg">Forgot your password?</h2>
              <p className="text-sm text-gray-500 mt-1">Enter your email and we'll send you a reset link.</p>
            </div>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all" />
            <button type="submit" disabled={loading || !email.includes("@")}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-60 transition-all">
              {loading ? "Sending…" : "Send Reset Link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

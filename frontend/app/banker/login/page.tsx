"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { loginUser, registerUser, saveAuth } from "../../../lib/api";
import { Building2, Eye, EyeOff, ArrowRight, Loader2, ShieldCheck } from "lucide-react";

export default function BankerLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const token = mode === "login"
        ? await loginUser(email, password)
        : await registerUser(name, email, password, "banker");
      if (token.role !== "banker") {
        setError("This portal is for bank officers only. Customers must use the Customer Portal.");
        return;
      }
      saveAuth(token);
      router.push("/banker/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "linear-gradient(135deg, #F0FDF4 0%, #F8FAFC 50%, #EFF6FF 100%)" }}>

      {/* Left panel — branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] bg-slate-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-5">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="banker-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#banker-grid)" />
          </svg>
        </div>
        {/* Emerald accent glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-12">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/30">
              <Building2 size={20} className="text-emerald-400" />
            </div>
            <span className="text-white font-bold text-lg">SecureBank</span>
          </div>
          <h2 className="text-3xl font-bold text-white leading-snug mb-4">
            Underwriting<br />Control Center
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Review AI-assessed KYC sessions, manage loan approvals, and maintain compliance with the integrated audit trail.
          </p>
        </div>

        <div className="relative space-y-4">
          {[
            { icon: "🤖", title: "AI Risk Scoring", desc: "Automated confidence analysis" },
            { icon: "📋", title: "Audit Trail", desc: "Full regulatory compliance logs" },
            { icon: "⚖️", title: "Human Override", desc: "Final approval authority" },
          ].map((f) => (
            <div key={f.title} className="flex items-center gap-4 bg-white/[0.06] rounded-xl px-4 py-3 border border-white/[0.08]">
              <span className="text-2xl">{f.icon}</span>
              <div>
                <p className="text-white font-semibold text-sm">{f.title}</p>
                <p className="text-slate-400 text-xs">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900">
              <Building2 size={20} className="text-emerald-400" />
            </div>
            <span className="text-slate-900 font-bold text-xl">SecureBank</span>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            {/* Header with emerald top strip */}
            <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500" />
            <div className="px-7 pt-6 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Secured Access</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Banker Portal</h1>
              <p className="text-slate-500 text-sm mt-0.5">Sign in to the underwriting dashboard</p>
            </div>

            <div className="p-7">
              {/* Tab toggle */}
              <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
                {(["login", "register"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setError(null); }}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                      mode === m
                        ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {m === "login" ? "Sign In" : "Register Officer"}
                  </button>
                ))}
              </div>

              <form onSubmit={handle} className="space-y-4">
                {mode === "register" && (
                  <div>
                    <label htmlFor="banker-name" className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Officer Full Name
                    </label>
                    <input
                      id="banker-name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      placeholder="Priya Mehta"
                      className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 transition font-medium"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="banker-email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Bank Email Address
                  </label>
                  <input
                    id="banker-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="officer@securebank.in"
                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 transition font-medium"
                  />
                </div>

                <div>
                  <label htmlFor="banker-password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="banker-password"
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="Enter your password"
                      className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 transition font-medium pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
                    >
                      {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                    <svg className="h-4 w-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="text-sm font-medium text-red-700">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white hover:bg-slate-800 active:bg-black transition shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <><Loader2 size={16} className="animate-spin" /> Please wait…</>
                  ) : (
                    <>{mode === "login" ? "Sign In to Dashboard" : "Register Officer Account"} <ArrowRight size={15} /></>
                  )}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-slate-500">
                Are you a customer?{" "}
                <a href="/login" className="text-blue-600 font-semibold hover:underline">
                  Customer Portal →
                </a>
              </p>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            Authorized personnel only. All access is logged and audited.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

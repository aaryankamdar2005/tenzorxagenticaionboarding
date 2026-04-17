"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { loginUser, registerUser, saveAuth } from "../../lib/api";
import { Eye, EyeOff, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";

export default function CustomerLoginPage() {
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
        : await registerUser(name, email, password, "customer");
      if (token.role !== "customer") {
        setError("This portal is for customers only. Bankers must use the Banker Portal.");
        return;
      }
      saveAuth(token);
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "linear-gradient(135deg, #EFF6FF 0%, #F8FAFC 50%, #F0FDF4 100%)" }}>

      {/* Left panel — branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] bg-blue-600 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative">
          <div className="flex items-center gap-3 mb-12">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <ShieldCheck size={20} className="text-white" />
            </div>
            <span className="text-white font-bold text-lg">SecureBank</span>
          </div>
          <h2 className="text-3xl font-bold text-white leading-snug mb-4">
            AI-Powered<br />Video KYC
          </h2>
          <p className="text-blue-100 text-sm leading-relaxed">
            Complete your identity verification in minutes from the comfort of your home. Secure, fast, and fully compliant.
          </p>
        </div>

        <div className="relative space-y-4">
          {[
            { icon: "🎥", title: "Video Verification", desc: "Real-time AI identity check" },
            { icon: "🔒", title: "Bank-grade Security", desc: "256-bit encrypted sessions" },
            { icon: "⚡", title: "Instant Results", desc: "Loan decision in minutes" },
          ].map((f) => (
            <div key={f.title} className="flex items-center gap-4 bg-white/10 rounded-xl px-4 py-3">
              <span className="text-2xl">{f.icon}</span>
              <div>
                <p className="text-white font-semibold text-sm">{f.title}</p>
                <p className="text-blue-200 text-xs">{f.desc}</p>
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
              <ShieldCheck size={20} className="text-white" />
            </div>
            <span className="text-slate-900 font-bold text-xl">SecureBank</span>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-7 pt-7 pb-5 border-b border-slate-100">
              <h1 className="text-2xl font-bold text-slate-900">Customer Portal</h1>
              <p className="text-slate-500 text-sm mt-1">Sign in or create your account to begin KYC</p>
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
                    {m === "login" ? "Sign In" : "Create Account"}
                  </button>
                ))}
              </div>

              <form onSubmit={handle} className="space-y-4">
                {mode === "register" && (
                  <div>
                    <label htmlFor="customer-name" className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Full Name
                    </label>
                    <input
                      id="customer-name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      placeholder="Rahul Sharma"
                      className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 transition font-medium"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="customer-email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="customer-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 transition font-medium"
                  />
                </div>

                <div>
                  <label htmlFor="customer-password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="customer-password"
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="Enter your password"
                      className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 transition font-medium pr-12"
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
                  className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white hover:bg-blue-700 active:bg-blue-800 transition shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <><Loader2 size={16} className="animate-spin" /> Please wait…</>
                  ) : (
                    <>{mode === "login" ? "Sign In" : "Create Account"} <ArrowRight size={15} /></>
                  )}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-slate-500">
                Are you a banker?{" "}
                <a href="/banker/login" className="text-blue-600 font-semibold hover:underline">
                  Banker Portal →
                </a>
              </p>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

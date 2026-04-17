"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { loginUser, registerUser, saveAuth } from "../../lib/api";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";

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
        setError("This portal is for customers only. Bankers use the Banker Portal.");
        return;
      }
      saveAuth(token);
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-electric-cyan/10 border border-electric-cyan/20 mb-4">
            <ShieldCheck className="text-electric-cyan" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white">Customer Portal</h1>
          <p className="text-slate-500 text-sm mt-1">SecureBank · AI KYC System</p>
        </div>

        <div className="rounded-2xl border border-slate-700/50 bg-slate-panel/30 backdrop-blur-xl p-8">
          {/* Tab */}
          <div className="flex rounded-xl bg-black/30 p-1 mb-6">
            {(["login", "register"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                  mode === m ? "bg-electric-cyan/20 text-electric-cyan border border-electric-cyan/30"
                  : "text-slate-500 hover:text-slate-300"
                }`}>
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <form onSubmit={handle} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} required
                  placeholder="Rahul Sharma"
                  className="w-full rounded-xl border border-slate-700 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-electric-cyan/50 transition placeholder:text-slate-600" />
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-700 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-electric-cyan/50 transition placeholder:text-slate-600" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-700 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-electric-cyan/50 transition placeholder:text-slate-600 pr-10" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-electric-cyan/10 border border-electric-cyan/40 py-3 text-sm font-semibold text-electric-cyan hover:bg-electric-cyan/20 hover:shadow-[0_0_20px_rgba(0,229,255,0.2)] transition disabled:opacity-50">
              {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-600">
            Are you a banker?{" "}
            <a href="/banker/login" className="text-electric-cyan hover:underline">Banker Portal →</a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

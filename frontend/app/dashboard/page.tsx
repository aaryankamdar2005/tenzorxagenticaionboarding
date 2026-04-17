"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { clearAuth, createSession, fetchCustomerSessions, loadAuth } from "../../lib/api";
import { AdminSession } from "../../lib/types";
import { 
  ShieldCheck, LogOut, Plus, FileText, CheckCircle2, XCircle, 
  Clock, ArrowRight, Wallet, BadgeCheck, ExternalLink 
} from "lucide-react";

export default function CustomerDashboard() {
  const router = useRouter();
  const [auth, setAuth] = useState<ReturnType<typeof loadAuth>>(null);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const a = loadAuth();
    setAuth(a);
    if (!a || a.role !== "customer") { router.replace("/login"); return; }
    fetchCustomerSessions(a.access_token)
      .then(setSessions)
      .catch(e => setError(e?.message ?? "Connection interrupted"))
      .finally(() => setLoading(false));
  }, []);

  const startNew = async () => {
    setStarting(true);
    try {
      const s = await createSession();
      router.push(`/onboarding/${s.session_id}`);
    } catch { setStarting(false); }
  };

  const logout = () => { clearAuth(); router.push("/login"); };

  return (
    <div className="min-h-screen bg-bg-primary text-brand-navy font-sans">
      {/* Institutional Header */}
      <header className="border-b border-border-subtle bg-white shadow-sm px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-1">SecureBank Personal</p>
              <h1 className="text-xl font-bold leading-none">Loans & Onboarding</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
               <p className="text-sm font-bold text-brand-navy leading-none mb-1">{auth?.name}</p>
               <p className="text-[10px] text-slate-400 uppercase tracking-widest leading-none">Verified Customer</p>
            </div>
            <button onClick={logout} className="p-2 border border-border-subtle rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-10">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-10 border-b border-border-subtle">
           <div>
              <h2 className="text-3xl font-bold text-brand-navy mb-2">Welcome back.</h2>
              <p className="text-slate-500">Manage your loan applications and identity verification sessions here.</p>
           </div>
           <button 
              onClick={startNew} 
              disabled={starting}
              className="flex items-center justify-center gap-2 bg-brand-blue text-white px-8 py-4 rounded-full font-bold shadow-lg hover:bg-blue-700 transition active:scale-95 disabled:opacity-50"
           >
              {starting ? "Initializing..." : <><Plus size={20} /> New Application</>}
           </button>
        </div>

        {/* Dash Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
           <div className="bg-white border border-border-subtle rounded-2xl p-6 shadow-sm">
             <div className="flex items-center gap-3 text-brand-blue mb-4">
                <div className="p-2 bg-blue-50 rounded-lg"><Wallet size={20} /></div>
                <h3 className="font-bold text-sm uppercase tracking-wider">Active Credits</h3>
             </div>
             <p className="text-3xl font-black text-brand-navy">{sessions.filter(s => s.review_status === "APPROVED").length}</p>
             <p className="text-xs text-slate-400 mt-1 font-medium">Approved loan agreements</p>
           </div>
           <div className="bg-white border border-border-subtle rounded-2xl p-6 shadow-sm">
             <div className="flex items-center gap-3 text-amber-600 mb-4">
                <div className="p-2 bg-amber-50 rounded-lg"><Clock size={20} /></div>
                <h3 className="font-bold text-sm uppercase tracking-wider">In Progress</h3>
             </div>
             <p className="text-3xl font-black text-brand-navy">{sessions.filter(s => !s.review_status || s.review_status === "PENDING").length}</p>
             <p className="text-xs text-slate-400 mt-1 font-medium">Pending bank approval</p>
           </div>
           <div className="bg-white border border-border-subtle rounded-2xl p-6 shadow-sm">
             <div className="flex items-center gap-3 text-emerald-600 mb-4">
                <div className="p-2 bg-emerald-50 rounded-lg"><BadgeCheck size={20} /></div>
                <h3 className="font-bold text-sm uppercase tracking-wider">Verified State</h3>
             </div>
             <p className="text-3xl font-black text-brand-navy">{sessions.length > 0 ? "Tier 1" : "Unverified"}</p>
             <p className="text-xs text-slate-400 mt-1 font-medium">Account verification status</p>
           </div>
        </div>

        {/* Application List */}
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2">
           <FileText size={14} /> Application History
        </h3>

        <div className="space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 bg-white border border-border-subtle rounded-2xl animate-pulse" />
            ))
          ) : sessions.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-border-subtle rounded-3xl">
               <p className="text-slate-400 text-sm mb-4 italic">You don't have any active loan applications.</p>
               <button onClick={startNew} className="text-brand-blue font-bold text-sm hover:underline">Start your first one now →</button>
            </div>
          ) : sessions.map((s) => {
            const status = s.review_status || "PENDING";
            const offer = s.latest_offer;
            const kyc = s.latest_extraction;

            return (
              <div key={s.session_id} className="bg-white border border-border-subtle rounded-2xl p-6 shadow-sm hover:shadow-md transition group">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  {/* Info */}
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl shrink-0 ${
                      status === "APPROVED" ? "bg-emerald-50 text-emerald-600" :
                      status === "REJECTED" ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-400"
                    }`}>
                      {status === "APPROVED" ? <CheckCircle2 size={24} /> : status === "REJECTED" ? <XCircle size={24} /> : <Clock size={24} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${
                          status === "APPROVED" ? "text-emerald-600" : status === "REJECTED" ? "text-red-500" : "text-amber-600"
                        }`}>
                          {status}
                        </span>
                        <span className="text-[10px] font-mono text-slate-300 uppercase tracking-tighter">REF: {s.session_id.slice(0, 12)}...</span>
                      </div>
                      <h4 className="text-lg font-bold text-brand-navy leading-tight">
                        {kyc?.loan_purpose || "General Purpose Credit Application"}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">Submitted on {s.created_at ? new Date(s.created_at).toLocaleDateString("en-IN", { day: 'numeric', month: 'long', year: 'numeric' }) : "—"}</p>
                    </div>
                  </div>

                  {/* Financials & Action */}
                  <div className="flex items-center gap-8 pl-12 md:pl-0">
                    {offer?.amount && (
                      <div className="text-right">
                         <p className="text-lg font-black text-brand-navy leading-tight">₹{offer.amount.toLocaleString()}</p>
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{offer.roi}% Fixed Interest</p>
                      </div>
                    )}
                    <div className="h-10 w-px bg-slate-100 hidden sm:block" />
                    <button className="flex items-center gap-2 text-sm font-bold text-brand-blue group-hover:gap-3 transition-all">
                      View Details <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Support Info */}
        <div className="mt-16 bg-slate-100/50 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
           <div className="text-center md:text-left">
              <h5 className="font-bold text-brand-navy mb-1">Confidential & Secure</h5>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">Your data is processed in compliance with SecureBank's digital banking privacy standards. All biometric sessions are encrypted.</p>
           </div>
           <div className="flex gap-4">
              <button className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-500 hover:text-brand-navy transition">
                <ExternalLink size={14} /> Help Center
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-500 hover:text-brand-navy transition">
                <BadgeCheck size={14} /> Compliance Info
              </button>
           </div>
        </div>
      </main>
    </div>
  );
}

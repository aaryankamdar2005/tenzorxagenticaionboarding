"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { clearAuth, createSession, fetchCustomerSessions, loadAuth, fetchMe, fetchEligibility } from "../../lib/api";
import { AdminSession } from "../../lib/types";
import { 
  ShieldCheck, Plus, FileText, CheckCircle2, XCircle, 
  Clock, ArrowRight, Wallet, BadgeCheck, ExternalLink, Activity
} from "lucide-react";

export default function CustomerDashboard() {
  const router = useRouter();
  const [auth, setAuth] = useState<ReturnType<typeof loadAuth>>(null);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ineligibleReason, setIneligibleReason] = useState<string | null>(null);

  useEffect(() => {
    const a = loadAuth();
    setAuth(a);
    if (!a || a.role !== "customer") { router.replace("/login"); return; }
    
    fetchMe(a.access_token).then(async (me) => {
      if (me.pan_number) {
         try {
           const res = await fetchEligibility(me.pan_number);
           if (res._status === 403 || !res.eligible) {
             if (res.reason === "COOLING_OFF_PERIOD") {
               setIneligibleReason(`Application Cooling-Off Period: Profile is in a mandatory cooling-off period. Please try again in ${res.days_remaining} days.`);
             } else if (res.reason === "EXCESSIVE_INQUIRIES") {
               setIneligibleReason("Excessive Credit Inquiries: We have detected multiple recent credit inquiries. To protect your credit score, we cannot process a new application at this time.");
             } else {
               setIneligibleReason("Application Rejected: We cannot process your application at this time based on regulatory rules.");
             }
           }
         } catch(e) { console.error("Failed to fetch eligibility", e); }
      }
    }).catch(e => console.log(e));

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

  return (
    <div className="font-sans px-4 sm:px-8 py-10">
      {/* Welcome Section - Hero */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 pb-10 border-b border-slate-300/20 dark:border-slate-700/50"
      >
         <div>
            <h2 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
              Welcome back, {auth?.name?.split(" ")[0] || "User"}.
            </h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Your secure digital banking environment.</p>
         </div>
         
         <button 
            onClick={startNew} 
            disabled={starting || !!ineligibleReason}
            className="group relative flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
         >
            {/* Glossy Button Base */}
            <div className="absolute inset-0 bg-brand-blue/80 backdrop-blur-xl border border-white/20 z-0"></div>
            {/* Hover Aura */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/50 to-emerald-400/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl z-0"></div>
            {/* Content */}
            <div className="relative z-10 flex items-center gap-2">
              {starting ? (
                <Activity size={20} className="animate-spin" />
              ) : (
                <Plus size={20} />
              )}
              {starting ? "Initializing Secure Container..." : "New Application"}
            </div>
         </button>
      </motion.div>

      {ineligibleReason && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-10 p-6 glass-panel border-l-4 border-l-red-500 rounded-2xl shadow-lg relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10"><ShieldCheck size={100} className="text-red-500" /></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 font-bold mb-2">
               <ShieldCheck size={20} /> Regulatory Hold Active
            </div>
            <p className="text-sm text-red-600/80 dark:text-red-400/80 leading-relaxed font-medium max-w-2xl">{ineligibleReason}</p>
          </div>
        </motion.div>
      )}

      {/* Dash Summary - Bento Box Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-12">
         {/* Active Credits - Spans 5 cols */}
         <motion.div 
           initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
           className="md:col-span-5 glass-panel rounded-3xl p-8 relative overflow-hidden group"
         >
           <div className="absolute -right-10 -top-10 w-40 h-40 bg-brand-blue/10 rounded-full blur-3xl group-hover:bg-brand-blue/20 transition-all"></div>
           <div className="flex items-center gap-4 text-brand-blue mb-8">
              <div className="p-3 bg-brand-blue/10 backdrop-blur-md rounded-2xl border border-brand-blue/20">
                <Wallet size={24} />
              </div>
              <h3 className="font-bold text-sm uppercase tracking-widest">Active Credits</h3>
           </div>
           <p className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
              {sessions.filter(s => s.review_status === "APPROVED").length}
           </p>
           <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium tracking-wide">Approved loan agreements</p>
         </motion.div>

         {/* In Progress - Spans 4 cols */}
         <motion.div 
           initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
           className="md:col-span-4 glass-panel rounded-3xl p-8 relative overflow-hidden group"
         >
           <div className="absolute -right-10 -top-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-all"></div>
           <div className="flex items-center gap-4 text-amber-500 mb-8">
              <div className="p-3 bg-amber-500/10 backdrop-blur-md rounded-2xl border border-amber-500/20">
                <Clock size={24} />
              </div>
              <h3 className="font-bold text-sm uppercase tracking-widest">In Progress</h3>
           </div>
           <p className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
              {sessions.filter(s => !s.review_status || s.review_status === "PENDING").length}
           </p>
           <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium tracking-wide">Pending bank approval</p>
         </motion.div>

         {/* Verified State - Spans 3 cols */}
         <motion.div 
           initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
           className="md:col-span-3 glass-panel rounded-3xl p-8 relative overflow-hidden group"
         >
           <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all"></div>
           <div className="flex items-center gap-4 text-emerald-500 mb-8">
              <div className="p-3 bg-emerald-500/10 backdrop-blur-md rounded-2xl border border-emerald-500/20">
                <BadgeCheck size={24} />
              </div>
              <h3 className="font-bold text-sm uppercase tracking-widest">Verified</h3>
           </div>
           <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter mt-4">
              {sessions.length > 0 ? "Tier 1" : "None"}
           </p>
           <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium tracking-wide">KYC Status</p>
         </motion.div>
      </div>

      {/* Application List */}
      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-6 flex items-center gap-2">
         <FileText size={14} /> Application Archive
      </h3>

      <div className="glass-panel rounded-3xl overflow-hidden p-2">
        <div className="space-y-1">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-slate-200/20 dark:bg-slate-800/20 rounded-2xl animate-pulse" />
            ))
          ) : sessions.length === 0 ? (
            <div className="py-20 text-center">
               <p className="text-slate-400 dark:text-slate-500 text-sm mb-4 font-medium">You don't have any active loan applications.</p>
               <button onClick={startNew} className="text-brand-blue font-bold text-sm hover:text-blue-400 transition">Start your first one now →</button>
            </div>
          ) : sessions.map((s, idx) => {
            const status = s.review_status || "PENDING";
            const offer = s.latest_offer;
            const kyc = s.latest_extraction;

            return (
              <motion.div 
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * idx }}
                key={s.session_id} 
                className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-5 rounded-2xl hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all group"
              >
                {/* Info */}
                <div className="flex items-center gap-5">
                  <div className={`p-3 rounded-2xl shrink-0 backdrop-blur-md shadow-inner ${
                    status === "APPROVED" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                    status === "REJECTED" ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                  }`}>
                    {status === "APPROVED" ? <CheckCircle2 size={24} /> : status === "REJECTED" ? <XCircle size={24} /> : <Clock size={24} />}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white leading-tight mb-1">
                      {kyc?.loan_purpose || "General Purpose Credit"}
                    </h4>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">
                        REF: {s.session_id.split("-")[0]}
                      </span>
                      <span className="text-[10px] text-slate-400/60">•</span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {s.created_at ? new Date(s.created_at).toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' }) : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Financials & Action */}
                <div className="flex items-center gap-8 pl-14 md:pl-0">
                  {offer?.amount && status === "APPROVED" && (
                    <div className="text-right">
                       <p className="text-lg font-black text-slate-900 dark:text-white leading-tight tracking-tight">₹{offer.amount.toLocaleString()}</p>
                       <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">{offer.roi}% Fixed</p>
                    </div>
                  )}
                  
                  {/* Status Badge */}
                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border backdrop-blur-sm ${
                    status === "APPROVED" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]" :
                    status === "REJECTED" ? "bg-red-500/10 text-red-500 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]" :
                    "bg-amber-500/10 text-amber-500 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                  }`}>
                    {status}
                  </div>

                  <button className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-brand-blue hover:bg-white transition-all group-hover:scale-105">
                    <ArrowRight size={18} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Footer Support Info */}
      <div className="mt-16 text-center pb-8 opacity-60 hover:opacity-100 transition-opacity">
         <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">SecureBank Systems</p>
         <p className="text-[10px] text-slate-400 max-w-sm mx-auto leading-relaxed">
           Your data is processed in compliance with digital banking privacy standards. All biometric sessions are E2E encrypted.
         </p>
      </div>
    </div>
  );
}

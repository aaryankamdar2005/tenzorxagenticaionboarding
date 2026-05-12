"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { fetchAdminSessions, loadAuth, updateSessionReview } from "../../../lib/api";
import { AdminSession } from "../../../lib/types";
import {
  Users, CheckCircle, XCircle, Clock, Search, FileText, ChevronRight, Activity, ShieldAlert
} from "lucide-react";

export default function BankerDashboard() {
  const router = useRouter();
  const auth = loadAuth();
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!auth || auth.role !== "banker") { router.replace("/banker/login"); return; }
    reload();
  }, [page]);

  const reload = () => {
    setLoading(true);
    fetchAdminSessions(page, 15)
      .then(d => { setSessions(d.sessions); setTotal(d.total); })
      .finally(() => setLoading(false));
  };

  const doAction = async (sessionId: string, action: "APPROVED" | "REJECTED" | "FLAGGED") => {
    setActionLoading(sessionId + action);
    try {
      await updateSessionReview(sessionId, action);
      setSessions(prev => prev.map(s =>
        s.session_id === sessionId ? { ...s, review_status: action } : s
      ));
    } finally { setActionLoading(null); }
  };

  const filtered = sessions.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.session_id.includes(q) ||
      s.latest_extraction?.full_name?.toLowerCase().includes(q) ||
      s.customer_name?.toLowerCase().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(total / 15));

  return (
    <div className="font-sans px-4 sm:px-8 py-10">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-6 border-b border-slate-300/20 dark:border-slate-700/50">
        <div>
           <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-1">
             Applicant Queue
           </h2>
           <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Review, underwrite, and manage loan applications.</p>
        </div>
        
        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search ID or name..."
              className="w-full glass-panel pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-brand-blue/50 transition-all placeholder:text-slate-400/70" />
          </div>
          <button onClick={reload} className="glass-button px-4 py-2 text-xs font-bold text-slate-700 dark:text-white">
            Refresh Data
          </button>
        </div>
      </div>

      {/* Statistics Cards - Glass Summaries */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Active Applications", value: total, icon: FileText, color: "text-brand-blue", glow: "shadow-[0_0_20px_rgba(59,130,246,0.15)]" },
          { label: "Final Approvals", value: sessions.filter(s => s.review_status === "APPROVED").length, icon: CheckCircle, color: "text-emerald-500", glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]" },
          { label: "Pending Review", value: sessions.filter(s => s.review_status === "PENDING" || !s.review_status).length, icon: Clock, color: "text-amber-500", glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]" },
          { label: "Rejected/Risk", value: sessions.filter(s => s.review_status === "REJECTED").length, icon: XCircle, color: "text-red-500", glow: "shadow-[0_0_20px_rgba(239,68,68,0.15)]" },
        ].map(({ label, value, icon: Icon, color, glow }, idx) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
            key={label} 
            className={`glass-panel p-5 rounded-2xl ${glow} flex items-center justify-between group overflow-hidden relative`}
          >
            <div className={`absolute -right-4 -bottom-4 w-20 h-20 rounded-full blur-2xl opacity-20 bg-current ${color}`}></div>
            <div>
              <p className={`text-2xl font-black ${color} tracking-tighter leading-none mb-2`}>{value}</p>
              <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{label}</p>
            </div>
            <div className={`p-2.5 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 ${color}`}>
              <Icon size={20} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Applications Table (High Density) */}
      <div className="glass-panel rounded-2xl overflow-hidden shadow-lg border border-white/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-300/20 dark:border-slate-700/50 bg-slate-100/30 dark:bg-slate-900/30">
                <th className="px-5 py-3 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Applicant / ID</th>
                <th className="px-5 py-3 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Credit Profile</th>
                <th className="px-5 py-3 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Bureau Findings</th>
                <th className="px-5 py-3 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">AI Loan Offer</th>
                <th className="px-5 py-3 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Risk Status</th>
                <th className="px-5 py-3 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300/10 dark:divide-slate-700/30">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-5 py-6"><div className="h-4 bg-slate-200/50 dark:bg-slate-700/50 rounded w-full" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-20 text-center text-slate-400 text-xs">No applications matching your criteria.</td></tr>
              ) : filtered.map((s) => {
                const uw = s.underwriting_result;
                const kyc = s.latest_extraction;
                const offer = s.latest_offer;
                const cibil = uw?.cibil_score ?? offer?.cibil_score ?? 0;
                const dti = uw?.dti_ratio ?? offer?.dti_ratio ?? 0;

                const status = s.review_status || "PENDING";

                return (
                  <tr key={s.session_id} className="hover:bg-slate-50/40 dark:hover:bg-white/5 transition duration-150">
                    <td className="px-5 py-4">
                      <p className="font-bold text-sm text-slate-900 dark:text-white leading-tight">{kyc?.full_name || s.customer_name || "Unknown Identity"}</p>
                      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter mt-1">{s.session_id.slice(0, 12)}...</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1 w-24">
                        <div className="flex justify-between items-end">
                          <span className={`text-sm font-black tracking-tight ${cibil >= 750 ? "text-emerald-500" : cibil >= 650 ? "text-amber-500" : "text-red-500"}`}>
                            {cibil || "—"}
                          </span>
                          <span className="text-[8px] uppercase tracking-widest text-slate-400">Score</span>
                        </div>
                        <div className="w-full h-1 bg-slate-200/50 dark:bg-slate-800 rounded-full overflow-hidden">
                           <div className={`h-full ${cibil >= 750 ? "bg-emerald-500 shadow-[0_0_10px_#10b981]" : cibil >= 650 ? "bg-amber-500 shadow-[0_0_10px_#f59e0b]" : "bg-red-500 shadow-[0_0_10px_#ef4444]"}`} style={{ width: `${(cibil/900)*100}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                       <div className="space-y-1">
                          <div className="flex justify-between items-center w-32">
                            <span className="text-[9px] text-slate-500 uppercase tracking-widest">DTI Ratio:</span>
                            <span className={`text-[10px] font-bold ${dti > 45 ? "text-red-500" : "text-slate-900 dark:text-slate-300"}`}>{dti ? dti.toFixed(1) + "%" : "—"}</span>
                          </div>
                          <div className="flex justify-between items-center w-32">
                            <span className="text-[9px] text-slate-500 uppercase tracking-widest">Income:</span>
                            <span className="text-[10px] font-bold text-slate-900 dark:text-slate-300">₹{kyc?.income_declaration?.toLocaleString() || "—"}</span>
                          </div>
                       </div>
                    </td>
                    <td className="px-5 py-4">
                       {offer?.amount ? (
                         <div>
                            <p className="text-xs font-bold text-brand-blue tracking-tight">₹{offer.amount.toLocaleString()}</p>
                            <p className="text-[9px] text-slate-500 font-medium">{offer.roi}% p.a. · {offer.tenure_months}m</p>
                         </div>
                       ) : <span className="text-[10px] text-slate-400 italic">No AI Offer</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest backdrop-blur-md ${
                        status === "APPROVED" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]" :
                        status === "REJECTED" ? "bg-red-500/10 text-red-500 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]" :
                        status === "FLAGGED" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]" :
                        "bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20"
                      }`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {status === "PENDING" ? (
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => router.push(`/admin/dashboard?sid=${s.session_id}`)}
                            className="glass-button px-3 py-1.5 text-[9px] font-bold text-brand-blue"
                          >
                            Review Details
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => router.push(`/admin/dashboard?sid=${s.session_id}`)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-blue hover:text-blue-400 transition"
                        >
                            Open Case File <ChevronRight size={10} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="mt-6 flex items-center justify-between">
         <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Page {page} of {totalPages}</p>
         <div className="flex gap-2">
           <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
             className="glass-button px-3 py-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 disabled:opacity-30 transition">Previous</button>
           <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
             className="glass-button px-3 py-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 disabled:opacity-30 transition">Next</button>
         </div>
      </div>
    </div>
  );
}

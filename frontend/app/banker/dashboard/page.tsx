"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { clearAuth, fetchAdminSessions, loadAuth, updateSessionReview } from "../../../lib/api";
import { AdminSession } from "../../../lib/types";
import {
  LogOut, Users, CheckCircle, XCircle, Clock, AlertTriangle, TrendingUp,
  ShieldCheck, Building2, ChevronRight, Search, FileText, BarChart3
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
    <div className="min-h-screen bg-bg-primary text-brand-navy font-sans">
      {/* Institutional Header */}
      <header className="border-b border-border-subtle bg-white shadow-sm px-8 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="text-brand-blue" size={24} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">SecureBank Underwriting</p>
              <h1 className="text-lg font-bold">Officer Control Panel</h1>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
              <Link href="/banker/dashboard" className="text-brand-blue border-b-2 border-brand-blue px-1 py-1">Applications</Link>
              <Link href="/admin" className="hover:text-brand-navy px-1 py-1 transition">Audit Logs</Link>
            </nav>
            <div className="flex items-center gap-4 pl-6 border-l border-border-subtle">
              <div className="text-right">
                <p className="text-xs font-bold text-brand-navy">{auth?.name}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-tighter">Authorized Officer</p>
              </div>
              <button onClick={() => { clearAuth(); router.push("/banker/login"); }}
                className="rounded-lg border border-border-subtle p-2 text-slate-400 hover:text-red-500 transition">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-10">
        {/* Statistics Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          {[
            { label: "Active Applications", value: total, icon: FileText, color: "text-brand-blue", bg: "bg-blue-50" },
            { label: "Final Approvals", value: sessions.filter(s => s.review_status === "APPROVED").length, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Pending Review", value: sessions.filter(s => s.review_status === "PENDING").length, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Rejected/Risk", value: sessions.filter(s => s.review_status === "REJECTED").length, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-xl bg-white border border-border-subtle p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${bg} ${color}`}><Icon size={20} /></div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by applicant name or session reference..."
              className="w-full rounded-xl border border-border-subtle bg-white pl-11 pr-4 py-3 text-sm text-brand-navy outline-none focus:border-brand-blue/50 transition shadow-sm" />
          </div>
          <div className="flex gap-2">
             <button className="px-4 py-3 bg-white border border-border-subtle rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition">Filter by Risk</button>
             <button onClick={reload} className="px-4 py-3 bg-white border border-border-subtle rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition">Refresh List</button>
          </div>
        </div>

        {/* Main Applications Table/Grid */}
        <div className="rounded-2xl border border-border-subtle bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-border-subtle">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Applicant / ID</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Credit Score</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Bureau Analysis</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Loan Offer</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-6 py-8"><div className="h-4 bg-slate-100 rounded w-full" /></td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-400 text-sm">No applications matching your criteria.</td></tr>
                ) : filtered.map((s) => {
                  const uw = s.underwriting_result;
                  const kyc = s.latest_extraction;
                  const offer = s.latest_offer;
                  const cibil = uw?.cibil_score ?? offer?.cibil_score ?? 0;
                  const dti = uw?.dti_ratio ?? offer?.dti_ratio ?? 0;

                  return (
                    <tr key={s.session_id} className="hover:bg-slate-50/50 transition duration-150">
                      <td className="px-6 py-5">
                        <p className="font-bold text-brand-navy">{kyc?.full_name || s.customer_name || "Unknown"}</p>
                        <p className="text-[10px] font-mono text-slate-400 uppercase">{s.session_id.slice(0, 12)}...</p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-baseline gap-1">
                          <span className={`text-base font-black ${cibil >= 750 ? "text-emerald-600" : cibil >= 650 ? "text-amber-600" : "text-red-600"}`}>
                            {cibil || "—"}
                          </span>
                        </div>
                        <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                           <div className={`h-full ${cibil >= 750 ? "bg-emerald-500" : cibil >= 650 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${(cibil/900)*100}%` }} />
                        </div>
                      </td>
                      <td className="px-6 py-5">
                         <div className="space-y-1">
                            <p className="text-[10px] text-slate-500 flex items-center gap-1">
                              DTI Ratio: <span className={`font-bold ${dti > 45 ? "text-red-500" : "text-brand-navy"}`}>{dti ? dti.toFixed(1) + "%" : "—"}</span>
                            </p>
                            <p className="text-[10px] text-slate-500">Verified Income: <span className="text-brand-navy">₹{kyc?.income_declaration?.toLocaleString() || "—"}</span></p>
                         </div>
                      </td>
                      <td className="px-6 py-5">
                         {offer?.amount ? (
                           <div className="space-y-0.5">
                              <p className="text-xs font-bold text-brand-blue">₹{offer.amount.toLocaleString()}</p>
                              <p className="text-[9px] text-slate-400">{offer.roi}% p.a. · {offer.tenure_months}m</p>
                           </div>
                         ) : <span className="text-xs text-slate-300 italic">No offer</span>}
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          s.review_status === "APPROVED" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                          s.review_status === "REJECTED" ? "bg-red-50 text-red-700 border border-red-100" :
                          s.review_status === "FLAGGED" ? "bg-amber-50 text-amber-700 border border-amber-100" :
                          "bg-slate-50 text-slate-500 border border-slate-100"
                        }`}>
                          {s.review_status || "Pending"}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        {s.review_status === "PENDING" || !s.review_status ? (
                          <div className="flex justify-end gap-2">
                            <button onClick={() => doAction(s.session_id, "APPROVED")} 
                              className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 transition">Approve</button>
                            <button onClick={() => doAction(s.session_id, "REJECTED")} 
                              className="px-3 py-1.5 bg-red-600 text-white text-[10px] font-bold rounded-lg hover:bg-red-700 transition">Reject</button>
                            <Link href={`/admin/dashboard?sid=${s.session_id}`}
                              className="px-3 py-1.5 bg-white border border-border-subtle text-slate-600 text-[10px] font-bold rounded-lg hover:bg-slate-50 transition">Review</Link>
                          </div>
                        ) : (
                          <Link href={`/admin/dashboard?sid=${s.session_id}`}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-blue hover:underline">
                              View Case File <ChevronRight size={10} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Table Footer */}
        <div className="mt-8 flex items-center justify-between">
           <p className="text-xs text-slate-400 font-medium font-mono text-uppercase">Showing page {page} of {totalPages} applications</p>
           <div className="flex gap-2">
             <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
               className="px-4 py-2 bg-white border border-border-subtle rounded-xl text-xs font-bold text-slate-600 disabled:opacity-40 transition hover:bg-slate-50">Previous</button>
             <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
               className="px-4 py-2 bg-white border border-border-subtle rounded-xl text-xs font-bold text-slate-600 disabled:opacity-40 transition hover:bg-slate-50">Next Page</button>
           </div>
        </div>
      </main>
    </div>
  );
}

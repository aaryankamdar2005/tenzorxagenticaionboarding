"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchAdminSessions } from "../../lib/api";
import { AdminSession } from "../../lib/types";
import { Building2, Search, ArrowLeft, Filter, FileText, CheckCircle, XCircle, Clock } from "lucide-react";

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchAdminSessions(page, 20)
      .then((d) => { setSessions(d.sessions); setTotal(d.total); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <main className="min-h-screen bg-bg-primary text-brand-navy font-sans">
      {/* Institutional Header */}
      <header className="border-b border-border-subtle bg-white shadow-sm px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="text-brand-blue" size={24} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">SecureBank Management</p>
              <h1 className="text-lg font-bold">Audit Archive · Sessions</h1>
            </div>
          </div>
          <Link href="/banker/dashboard" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-brand-navy transition">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
           <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Master Session Log</h2>
           <div className="flex gap-2">
             <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input placeholder="Search session logs..." className="pl-9 pr-4 py-2 text-xs border border-border-subtle rounded-lg outline-none focus:border-brand-blue/50" />
             </div>
             <button className="flex items-center gap-2 px-3 py-2 bg-white border border-border-subtle rounded-lg text-xs font-bold text-slate-600">
               <Filter size={14} /> Filters
             </button>
           </div>
        </div>

        {/* Audit List — table on large, cards on small */}
        <div className="rounded-2xl border border-border-subtle bg-white shadow-sm overflow-hidden">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-border-subtle">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Session ID</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Applicant</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Confidence</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Timestamp</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-6"><div className="h-3 bg-slate-100 rounded w-full" /></td>
                  </tr>
                ))
              ) : error ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-red-500 text-xs italic">System Error: {error}</td></tr>
              ) : sessions.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-400 text-sm">No archive data available.</td></tr>
              ) : sessions.map((s) => (
                <tr key={s.session_id} className="hover:bg-slate-50/50 transition duration-150">
                  <td className="px-6 py-4 font-mono text-[10px] text-slate-500 uppercase tracking-tighter">
                    {s.session_id}
                  </td>
                  <td className="px-6 py-4 font-semibold text-brand-navy text-xs">
                    {s.latest_extraction?.full_name || s.customer_name || "Anonymous"}
                  </td>
                  <td className="px-6 py-4">
                    {s.final_score ? (
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${s.final_score.confidence_score >= 80 ? "text-emerald-600" : s.final_score.confidence_score >= 60 ? "text-amber-600" : "text-red-600"}`}>
                           {s.final_score.confidence_score}%
                        </span>
                        <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                           <div className={`h-full ${s.final_score.confidence_score >= 80 ? "bg-emerald-500" : s.final_score.confidence_score >= 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${s.final_score.confidence_score}%` }} />
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-300 italic">No score</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                     <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                       s.review_status === "APPROVED" ? "bg-emerald-50 text-emerald-600" :
                       s.review_status === "REJECTED" ? "bg-red-50 text-red-600" :
                       "bg-slate-100 text-slate-500"
                     }`}>
                       {s.review_status || "Logged"}
                     </span>
                  </td>
                  <td className="px-6 py-4 text-[10px] text-slate-500">
                    {s.created_at ? new Date(s.created_at).toLocaleString("en-IN", { hour12: false }) : "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/admin/dashboard?sid=${s.session_id}`} className="text-[10px] font-bold text-brand-blue hover:underline">
                      View File
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>{/* end hidden sm:block */}

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 animate-pulse"><div className="h-3 bg-slate-100 rounded w-full" /></div>
              ))
            ) : error ? (
              <div className="p-6 text-center text-red-600 text-sm">{error}</div>
            ) : sessions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No archive data available.</div>
            ) : sessions.map((s) => (
              <div key={s.session_id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    s.review_status === "APPROVED" ? "bg-emerald-50 text-emerald-700" :
                    s.review_status === "REJECTED" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"
                  }`}>{s.review_status || "Logged"}</span>
                  <Link href={`/admin/dashboard?sid=${s.session_id}`} className="text-xs font-bold text-blue-600 hover:underline">View File →</Link>
                </div>
                <p className="font-semibold text-slate-900 text-sm">{s.latest_extraction?.full_name || s.customer_name || "Anonymous"}</p>
                <p className="text-[10px] font-mono text-slate-400">{s.session_id}</p>
                <p className="text-[10px] text-slate-400">{s.created_at ? new Date(s.created_at).toLocaleString("en-IN") : "—"}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-2 bg-white border border-border-subtle rounded-xl text-xs font-bold text-slate-600 disabled:opacity-40 transition hover:bg-slate-50">Prev</button>
            <div className="flex items-center px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">{page} / {totalPages}</div>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-4 py-2 bg-white border border-border-subtle rounded-xl text-xs font-bold text-slate-600 disabled:opacity-40 transition hover:bg-slate-50">Next</button>
          </div>
        )}
      </div>
    </main>
  );
}

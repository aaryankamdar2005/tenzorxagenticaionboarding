"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { fetchSessionDetail, updateSessionReview } from "../../../lib/api";
import { AdminSession } from "../../../lib/types";
import { ShieldCheck, AlertTriangle, User, FileText, Activity, Loader2, ChevronLeft, Fingerprint, MapPin, Search } from "lucide-react";

// ── Glowing Glass Orb ───────────────────────────────────────────────────────
function GlassOrb({ score }: { score: number }) {
  const isGood = score >= 75;
  const isWarn = score >= 50 && score < 75;
  const colorClass = isGood ? "from-emerald-400 to-emerald-600" : isWarn ? "from-amber-400 to-amber-600" : "from-red-400 to-red-600";
  const shadowClass = isGood ? "shadow-[0_0_40px_rgba(16,185,129,0.4)]" : isWarn ? "shadow-[0_0_40px_rgba(245,158,11,0.4)]" : "shadow-[0_0_40px_rgba(239,68,68,0.4)]";
  
  return (
    <div className="flex flex-col items-center justify-center p-6 relative">
      {/* Orb Container */}
      <div className={`relative w-40 h-40 rounded-full bg-gradient-to-br ${colorClass} ${shadowClass} flex items-center justify-center mb-6`}>
        {/* Inner Glass Layer */}
        <div className="absolute inset-1 rounded-full bg-slate-900/40 backdrop-blur-sm border border-white/20 shadow-inner z-10 flex flex-col items-center justify-center">
          <span className="text-4xl font-black text-white drop-shadow-md">{score}%</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/70">Confidence</span>
        </div>
        {/* Highlight Reflection */}
        <div className="absolute top-2 left-4 w-16 h-8 bg-white/30 rounded-full blur-md transform -rotate-45 z-20"></div>
      </div>
      <p className={`text-sm font-black tracking-widest uppercase ${isGood ? "text-emerald-500" : isWarn ? "text-amber-500" : "text-red-500"}`}>
        {isGood ? "STRONG APPROVAL" : isWarn ? "NEEDS REVIEW" : "HIGH RISK"}
      </p>
    </div>
  );
}

// ── KYC field row ────────────────────────────────────────────────────────────
function KYCRow({ label, spoken, ocr }: { label: string; spoken?: string | null; ocr?: string | null }) {
  const mismatch = spoken && ocr && spoken.toLowerCase().trim() !== ocr.toLowerCase().trim();
  return (
    <tr className={`border-b border-slate-300/10 dark:border-slate-700/30 ${mismatch ? "bg-red-500/10" : "hover:bg-slate-500/5 transition-colors"}`}>
      <td className="py-3 px-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold whitespace-nowrap">{label}</td>
      <td className="py-3 px-4 text-xs font-medium text-slate-900 dark:text-slate-300">{spoken ?? <span className="italic text-slate-500/50">—</span>}</td>
      <td className={`py-3 px-4 text-xs font-bold ${mismatch ? "text-red-500" : "text-slate-900 dark:text-slate-300"}`}>
        {ocr ?? <span className="italic text-slate-500/50">—</span>}
        {mismatch && <span className="ml-2 text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded uppercase tracking-widest">Mismatch</span>}
      </td>
    </tr>
  );
}

// ── Risk badge ───────────────────────────────────────────────────────────────
function RiskBadge({ ok, label, trueLabel, falseLabel }: { ok: boolean; label: string; trueLabel?: string; falseLabel?: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-900/5 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 px-4 py-3">
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</span>
      <span className={`rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-widest border backdrop-blur-md ${ok ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-red-500/10 text-red-500 border-red-500/30"}`}>
        {ok ? (trueLabel ?? "Pass") : (falseLabel ?? "Fail")}
      </span>
    </div>
  );
}

// ── Main dashboard (inner) ────────────────────────────────────────────────────
function DashboardInner() {
  const params = useSearchParams();
  const router = useRouter();
  const sessionId = params.get("sid");

  type DetailSession = AdminSession & { transcripts: Array<{ user: string; agent: string; created_at: string }> };
  const [session, setSession] = useState<DetailSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewDone, setReviewDone] = useState<string | null>(null);
  
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [approvedAmount, setApprovedAmount] = useState<number | "">("");
  const [approvedRoi, setApprovedRoi] = useState<number | "">("");

  useEffect(() => {
    if (!sessionId) return;
    fetchSessionDetail(sessionId)
      .then((d) => {
        setSession(d as DetailSession);
        if (d.latest_offer) {
          setApprovedAmount(d.latest_offer.amount || "");
          setApprovedRoi(d.latest_offer.roi || "");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const doReview = async (action: "APPROVED" | "REJECTED" | "FLAGGED") => {
    if (!sessionId) return;
    setReviewing(true);
    try {
      const amt = action === "APPROVED" && typeof approvedAmount === "number" ? approvedAmount : undefined;
      const roi = action === "APPROVED" && typeof approvedRoi === "number" ? approvedRoi : undefined;
      
      await updateSessionReview(sessionId, action, undefined, amt, roi);
      setReviewDone(action);
      if (session) {
        const updatedSession = { ...session, review_status: action };
        if (action === "APPROVED" && amt !== undefined) {
           if (!updatedSession.latest_offer) updatedSession.latest_offer = {} as any;
           updatedSession.latest_offer!.amount = amt;
           updatedSession.latest_offer!.roi = roi ?? updatedSession.latest_offer!.roi;
        }
        setSession(updatedSession);
      }
      setShowApprovalForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setReviewing(false);
    }
  };

  if (!sessionId || error || !session) return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="glass-panel p-8 rounded-2xl text-center max-w-md w-full">
        <AlertTriangle className="mx-auto mb-4 text-red-500" size={40} />
        <p className="text-slate-900 dark:text-white font-bold mb-4">{error ?? "Session not found"}</p>
        <button onClick={() => router.back()} className="glass-button px-6 py-2 text-sm font-bold text-slate-700 dark:text-white rounded-xl">
          Go Back
        </button>
      </div>
    </div>
  );

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <Loader2 className="h-10 w-10 animate-spin text-brand-blue" />
    </div>
  );

  const kyc = session.latest_extraction ?? {};
  const offer = session.latest_offer;
  const score = session.final_score;
  const liveness = session.liveness_result;
  const geo = session.geo_result;
  const doc = session.document_verification;

  return (
    <div className="font-sans px-4 sm:px-8 py-10 pb-20">
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="glass-button p-2 rounded-xl text-slate-600 dark:text-slate-300">
            <ChevronLeft size={20} />
          </button>
          <div>
             <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
               Ref: {sessionId.slice(0,12)}
             </p>
             <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">
               {kyc.full_name ?? "Anonymous Applicant"}
             </h2>
          </div>
        </div>
        <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border backdrop-blur-md flex items-center gap-2 ${
          session.review_status === "APPROVED" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" :
          session.review_status === "REJECTED" ? "bg-red-500/10 text-red-500 border-red-500/30" :
          session.review_status === "FLAGGED" ? "bg-amber-500/10 text-amber-500 border-amber-500/30" :
          "bg-slate-500/10 text-slate-500 border-slate-500/30"
        }`}>
          {session.review_status || "PENDING REVIEW"}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">

        {/* ── LEFT COLUMN ────────────────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Transcript */}
          <div className="glass-panel rounded-3xl p-6 md:p-8">
            <h2 className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              <FileText size={16} className="text-brand-blue" /> Conversation Transcript
            </h2>
            <div className="max-h-[500px] space-y-4 overflow-y-auto pr-2 custom-scrollbar">
              {session.transcripts && session.transcripts.length > 0 ? session.transcripts.map((t, i) => (
                <div key={i} className="flex flex-col gap-1">
                  {t.user && (
                    <div className="self-end max-w-[85%] rounded-2xl rounded-tr-sm bg-slate-200 dark:bg-slate-800 p-4 border border-slate-300/50 dark:border-slate-700/50">
                      <p className="text-xs text-slate-900 dark:text-slate-100">{t.user}</p>
                    </div>
                  )}
                  {t.agent && (
                    <div className="self-start max-w-[85%] rounded-2xl rounded-tl-sm bg-brand-blue/10 p-4 border border-brand-blue/20">
                      <p className="text-xs text-brand-blue font-medium leading-relaxed">{t.agent}</p>
                    </div>
                  )}
                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1 opacity-50 px-1">
                    {t.created_at ? new Date(t.created_at).toLocaleTimeString() : ""}
                  </p>
                </div>
              )) : (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400/50">
                  <Search size={32} className="mb-3" />
                  <p className="text-sm font-bold">No transcript available.</p>
                </div>
              )}
            </div>
          </div>

          {/* Liveness & Bio */}
          <div className="glass-panel rounded-3xl p-6 md:p-8">
            <h2 className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              <Fingerprint size={16} className="text-emerald-500" /> Biometric Verification
            </h2>
            {liveness ? (
              <div className="space-y-3">
                <RiskBadge ok={liveness.passed} label={`Challenge Sequence: "${liveness.challenge}"`} trueLabel="Verified" falseLabel="Failed" />
                <div className="flex items-center justify-between rounded-xl bg-slate-900/5 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 px-4 py-3">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Authentication Attempts</span>
                  <span className={`text-xs font-black ${liveness.attempts <= 1 ? "text-emerald-500" : liveness.attempts === 2 ? "text-amber-500" : "text-red-500"}`}>
                    {liveness.attempts} / 3
                  </span>
                </div>
              </div>
            ) : (
               <p className="text-xs font-bold text-slate-400/50 py-4 text-center">Liveness check data unavailable.</p>
            )}
          </div>

        </div>

        {/* ── RIGHT COLUMN ───────────────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* AI Confidence Score Orb */}
          <div className="glass-panel rounded-3xl p-6 md:p-8">
            <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              <Activity size={16} className="text-brand-blue" /> AI Analysis Engine
            </h2>
            {score ? (
              <div className="flex flex-col items-center gap-4">
                <GlassOrb score={score.confidence_score} />
                <div className={`w-full rounded-2xl px-5 py-4 text-center text-xs font-bold uppercase tracking-widest border backdrop-blur-md ${
                  score.approval_recommendation === "APPROVE" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" :
                  score.approval_recommendation === "REJECT"  ? "bg-red-500/10 text-red-500 border-red-500/30" :
                  "bg-amber-500/10 text-amber-500 border-amber-500/30"
                }`}>
                  {score.approval_recommendation === "APPROVE" ? "System Recommends Approval" :
                   score.approval_recommendation === "REJECT"  ? "System Recommends Rejection" :
                   "Requires Manual Intervention"}
                </div>
                {score.reasons.length > 0 && (
                  <div className="w-full space-y-2 mt-2">
                    {score.reasons.map((r, i) => (
                      <p key={i} className="text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-300/50 dark:border-slate-700/50 leading-relaxed">
                        {r}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
               <p className="text-xs font-bold text-slate-400/50 py-10 text-center">Analysis engine pending.</p>
            )}
          </div>

          {/* KYC vs OCR comparison */}
          <div className="glass-panel rounded-3xl p-6 md:p-8 overflow-hidden">
            <h2 className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              <User size={16} className="text-amber-500" /> Data Reconciliation
            </h2>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full min-w-[300px]">
                <thead>
                  <tr className="border-b border-slate-300/20 dark:border-slate-700/50">
                    <th className="pb-3 px-4 text-left text-[9px] font-bold uppercase tracking-widest text-slate-400 w-1/3">Field</th>
                    <th className="pb-3 px-4 text-left text-[9px] font-bold uppercase tracking-widest text-slate-400 w-1/3">Agent Record</th>
                    <th className="pb-3 px-4 text-left text-[9px] font-bold uppercase tracking-widest text-slate-400 w-1/3">OCR Extraction</th>
                  </tr>
                </thead>
                <tbody>
                  <KYCRow label="Full Name" spoken={kyc.full_name} ocr={doc?.ocr_name} />
                  <KYCRow label="Date of Birth" spoken={kyc.dob} ocr={doc?.ocr_dob} />
                  <KYCRow label="Employer" spoken={kyc.employer} ocr={undefined} />
                  <KYCRow label="Income (INR)" spoken={kyc.income_declaration != null ? `₹${kyc.income_declaration.toLocaleString()}` : null} ocr={undefined} />
                  <KYCRow label="Purpose" spoken={kyc.loan_purpose} ocr={undefined} />
                </tbody>
              </table>
            </div>
            {doc && (
              <div className={`mt-6 flex items-center justify-between rounded-2xl px-5 py-4 text-xs font-bold uppercase tracking-widest border backdrop-blur-md ${doc.is_match ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-amber-500/10 text-amber-500 border-amber-500/30"}`}>
                <span>OCR Consensus</span>
                <span>{doc.match_score}% Confidence</span>
              </div>
            )}
          </div>

          {/* Fraud Signals */}
          <div className="glass-panel rounded-3xl p-6 md:p-8">
            <h2 className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              <ShieldCheck size={16} className="text-red-500" /> Risk Telemetry
            </h2>
            <div className="space-y-3">
              <RiskBadge
                ok={!geo?.is_mismatch}
                label={`Geo-IP Anomaly${geo?.distance_km != null ? ` (${geo.distance_km}km delta)` : ""}`}
                trueLabel="Cleared" falseLabel="Flagged"
              />
              <RiskBadge ok={!kyc.stress_flag} label="Vocal Stress Micro-tremors" trueLabel="Cleared" falseLabel="Flagged" />
              {offer && (
                <div className="flex items-center justify-between rounded-xl bg-slate-900/5 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 px-4 py-3">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Credit Facility Offer</span>
                  <span className={`rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-widest border backdrop-blur-md ${
                    offer.status === "APPROVED" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" :
                    offer.status === "REJECTED" ? "bg-red-500/10 text-red-500 border-red-500/30" : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                  }`}>
                    {offer.status}
                    {offer.amount ? ` · ₹${offer.amount.toLocaleString()} APVD` : ""}
                    {offer.requested_amount ? ` (REQ: ₹${offer.requested_amount.toLocaleString()})` : ""}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Human Override */}
          <div className="rounded-3xl bg-slate-950 border border-slate-800 p-6 md:p-8 shadow-2xl relative overflow-hidden">
            {/* Dark background glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/10 to-transparent pointer-events-none"></div>
            
            <h2 className="mb-2 text-sm font-bold text-white relative z-10">Officer Override Authority</h2>
            <p className="mb-6 text-[10px] text-slate-400 leading-relaxed max-w-sm relative z-10">Your final decision overrides all automated telemetry and is permanently written to the immutable audit ledger.</p>

            {reviewDone ? (
              <div className={`rounded-2xl px-6 py-5 text-center text-xs font-bold uppercase tracking-widest border-2 relative z-10 backdrop-blur-md ${
                reviewDone === "APPROVED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)]" :
                reviewDone === "REJECTED" ? "bg-red-500/10 text-red-400 border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.15)]" : "bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.15)]"
              }`}>
                Command Executed: {reviewDone}
              </div>
            ) : (
              <div className="flex flex-col gap-4 relative z-10">
                {!showApprovalForm ? (
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setShowApprovalForm(true)} disabled={reviewing}
                      className="group relative rounded-xl px-2 py-4 text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-50 transition-all overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-emerald-600 border border-emerald-500 group-hover:bg-emerald-500 transition-colors"></div>
                      <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
                      <span className="relative z-10 flex items-center justify-center gap-1">Approve</span>
                    </button>
                    <button
                      onClick={() => doReview("REJECTED")} disabled={reviewing}
                      className="group relative rounded-xl px-2 py-4 text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-50 transition-all overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-red-600 border border-red-500 group-hover:bg-red-500 transition-colors"></div>
                      <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
                      <span className="relative z-10 flex items-center justify-center gap-1">
                        {reviewing ? <Loader2 size={14} className="animate-spin" /> : "Reject"}
                      </span>
                    </button>
                    <button
                      onClick={() => doReview("FLAGGED")} disabled={reviewing}
                      className="group relative rounded-xl px-2 py-4 text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-50 transition-all overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-amber-600 border border-amber-500 group-hover:bg-amber-500 transition-colors"></div>
                      <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
                      <span className="relative z-10 flex items-center justify-center gap-1">
                        {reviewing ? <Loader2 size={14} className="animate-spin" /> : "Flag"}
                      </span>
                    </button>
                  </div>
                ) : (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4 rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-inner">
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-brand-blue mb-2">Final Authorized Amount (₹)</label>
                      <input 
                        type="number" 
                        value={approvedAmount} 
                        onChange={e => setApprovedAmount(e.target.value ? Number(e.target.value) : "")}
                        className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-3 text-sm font-bold text-white focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none transition-all"
                        placeholder="e.g. 200000"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-brand-blue mb-2">Final Authorized ROI (%)</label>
                      <input 
                        type="number" step="0.1"
                        value={approvedRoi} 
                        onChange={e => setApprovedRoi(e.target.value ? Number(e.target.value) : "")}
                        className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-3 text-sm font-bold text-white focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none transition-all"
                        placeholder="e.g. 14.5"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-3">
                      <button
                        onClick={() => doReview("APPROVED")} disabled={reviewing || approvedAmount === ""}
                        className="rounded-xl bg-brand-blue py-3 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-blue-500 disabled:opacity-50 transition shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                      >
                        {reviewing ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Execute"}
                      </button>
                      <button
                        onClick={() => setShowApprovalForm(false)} disabled={reviewing}
                        className="rounded-xl bg-slate-800 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition border border-slate-700"
                      >
                        Abort
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center p-8"><div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" /></div>}>
      <DashboardInner />
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { fetchSessionDetail, updateSessionReview } from "../../../lib/api";
import { AdminSession } from "../../../lib/types";
import { Building2, ArrowLeft, ShieldCheck, AlertTriangle, User, FileText, Activity, Loader2 } from "lucide-react";

// ── Circular confidence ring ────────────────────────────────────────────────
function ConfidenceRing({ score }: { score: number }) {
  const r = 60;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(100, Math.max(0, score)) / 100);
  const color = score >= 75 ? "#059669" : score >= 50 ? "#D97706" : "#DC2626";
  const labelColor = score >= 75 ? "text-emerald-700" : score >= 50 ? "text-amber-700" : "text-red-700";
  const bgColor = score >= 75 ? "bg-emerald-50" : score >= 50 ? "bg-amber-50" : "bg-red-50";
  const border = score >= 75 ? "border-emerald-200" : score >= 50 ? "border-amber-200" : "border-red-200";

  return (
    <div className={`flex flex-col items-center gap-3 rounded-2xl border ${border} ${bgColor} p-6`}>
      <svg width="152" height="152">
        <circle cx="76" cy="76" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
        <circle cx="76" cy="76" r={r} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 76 76)" style={{ transition: "stroke-dashoffset 1.2s ease" }}
        />
        <text x="76" y="70" textAnchor="middle" fill="#0f172a" fontSize="26" fontWeight="bold" fontFamily="Inter,sans-serif">{score}%</text>
        <text x="76" y="90" textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="Inter,sans-serif">Confidence</text>
      </svg>
      <p className={`text-sm font-bold ${labelColor}`}>{score >= 75 ? "STRONG APPROVAL" : score >= 50 ? "NEEDS REVIEW" : "HIGH RISK"}</p>
    </div>
  );
}

// ── KYC field row ────────────────────────────────────────────────────────────
function KYCRow({ label, spoken, ocr }: { label: string; spoken?: string | null; ocr?: string | null }) {
  const mismatch = spoken && ocr && spoken.toLowerCase().trim() !== ocr.toLowerCase().trim();
  return (
    <tr className={`border-b border-slate-100 ${mismatch ? "bg-red-50" : ""}`}>
      <td className="py-2.5 pr-4 text-xs text-slate-500 font-medium whitespace-nowrap">{label}</td>
      <td className="py-2.5 pr-4 text-sm text-slate-800 font-medium">{spoken ?? <span className="italic text-slate-400">—</span>}</td>
      <td className={`py-2.5 text-sm font-medium ${mismatch ? "text-red-700 font-semibold" : "text-slate-800"}`}>
        {ocr ?? <span className="italic text-slate-400">—</span>}
        {mismatch && <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">⚠ mismatch</span>}
      </td>
    </tr>
  );
}

// ── Risk badge ───────────────────────────────────────────────────────────────
function RiskBadge({ ok, label, trueLabel, falseLabel }: { ok: boolean; label: string; trueLabel?: string; falseLabel?: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
      <span className="text-sm text-slate-700 font-medium">{label}</span>
      <span className={`rounded-full px-3 py-1 text-xs font-bold border ${ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
        {ok ? (trueLabel ?? "✓ Pass") : (falseLabel ?? "✗ Fail")}
      </span>
    </div>
  );
}

// ── Main dashboard (inner) ────────────────────────────────────────────────────
function DashboardInner() {
  const params = useSearchParams();
  const sessionId = params.get("sid");

  type DetailSession = AdminSession & { transcripts: Array<{ user: string; agent: string; created_at: string }> };
  const [session, setSession] = useState<DetailSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewDone, setReviewDone] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    fetchSessionDetail(sessionId)
      .then((d) => setSession(d as DetailSession))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const doReview = async (action: "APPROVED" | "REJECTED" | "FLAGGED") => {
    if (!sessionId) return;
    setReviewing(true);
    try {
      await updateSessionReview(sessionId, action);
      setReviewDone(action);
      if (session) setSession({ ...session, review_status: action });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setReviewing(false);
    }
  };

  if (!sessionId) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <p className="mb-3 text-slate-600">No session ID provided.</p>
        <Link href="/admin" className="text-blue-600 underline font-semibold">← Back to sessions</Link>
      </div>
    </div>
  );

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
    </div>
  );

  if (error || !session) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="max-w-md text-center">
        <p className="text-red-600 font-semibold mb-3">{error ?? "Session not found"}</p>
        <Link href="/admin" className="text-blue-600 underline font-semibold">← Back to sessions</Link>
      </div>
    </div>
  );

  const kyc = session.latest_extraction ?? {};
  const offer = session.latest_offer;
  const score = session.final_score;
  const liveness = session.liveness_result;
  const geo = session.geo_result;
  const doc = session.document_verification;

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shrink-0">
              <Building2 size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Risk Control Center</p>
              <h1 className="text-base font-bold text-slate-900">{kyc.full_name ?? "Anonymous Applicant"}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="font-mono text-xs text-slate-400 hidden sm:block">{sessionId?.slice(0, 8)}…</span>
            <Link href="/banker/dashboard" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition flex items-center gap-1.5">
              <ArrowLeft size={13} /> Dashboard
            </Link>
            <Link href="/admin" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition">Sessions</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 py-6 xl:grid-cols-[1.1fr_0.9fr]">

        {/* ── LEFT ────────────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Transcript */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
              <FileText size={13} /> Conversation Transcript
            </h2>
            <div className="max-h-80 space-y-2.5 overflow-y-auto pr-1">
              {session.transcripts && session.transcripts.length > 0 ? session.transcripts.map((t, i) => (
                <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                  {t.user && (
                    <div className="flex items-start gap-2 mb-2">
                      <span className="mt-0.5 shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-600">You</span>
                      <p className="text-sm text-slate-800">{t.user}</p>
                    </div>
                  )}
                  {t.agent && (
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-blue-700">Aria</span>
                      <p className="text-sm text-slate-700">{t.agent}</p>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 mt-2">{t.created_at ? new Date(t.created_at).toLocaleTimeString() : ""}</p>
                </div>
              )) : (
                <p className="py-8 text-center text-sm italic text-slate-400">Transcript not available for this session.</p>
              )}
            </div>
          </div>

          {/* Liveness */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
              <Activity size={13} /> Liveness Verification
            </h2>
            {liveness ? (
              <div className="space-y-2">
                <RiskBadge ok={liveness.passed} label={`Challenge: "${liveness.challenge}"`} trueLabel="✓ Passed" falseLabel="✗ Failed" />
                <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                  <span className="text-sm text-slate-700 font-medium">Attempts used</span>
                  <span className={`text-sm font-bold ${liveness.attempts <= 1 ? "text-emerald-700" : liveness.attempts === 2 ? "text-amber-700" : "text-red-700"}`}>
                    {liveness.attempts} / 3
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm italic text-slate-400">Liveness check not completed for this session.</p>
            )}
          </div>

        </div>

        {/* ── RIGHT ───────────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* AI Confidence Score */}
          {score ? (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <ShieldCheck size={13} /> AI Confidence Score
              </h2>
              <div className="flex flex-col items-center gap-4">
                <ConfidenceRing score={score.confidence_score} />
                <div className={`w-full rounded-xl px-4 py-3 text-center text-sm font-bold border ${
                  score.approval_recommendation === "APPROVE" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                  score.approval_recommendation === "REJECT"  ? "bg-red-50 text-red-800 border-red-200" :
                  "bg-amber-50 text-amber-800 border-amber-200"
                }`}>
                  {score.approval_recommendation === "APPROVE" ? "✓ AI Recommends APPROVAL" :
                   score.approval_recommendation === "REJECT"  ? "✗ AI Recommends REJECTION" :
                   "⚠ Refer for MANUAL REVIEW"}
                </div>
                {score.reasons.length > 0 && (
                  <div className="w-full space-y-1.5">
                    {score.reasons.map((r, i) => (
                      <p key={i} className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">• {r}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 text-center">
              <p className="text-sm italic text-slate-400">AI scoring pending — session may still be active.</p>
            </div>
          )}

          {/* KYC vs OCR comparison */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
              <User size={13} /> KYC Data vs Document OCR
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="pb-2 pt-2 px-1 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 pr-4">Field</th>
                    <th className="pb-2 pt-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 pr-4">Spoken</th>
                    <th className="pb-2 pt-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">OCR</th>
                  </tr>
                </thead>
                <tbody>
                  <KYCRow label="Full Name" spoken={kyc.full_name} ocr={doc?.ocr_name} />
                  <KYCRow label="Date of Birth" spoken={kyc.dob} ocr={doc?.ocr_dob} />
                  <KYCRow label="Employer" spoken={kyc.employer} ocr={undefined} />
                  <KYCRow label="Income (INR)" spoken={kyc.income_declaration != null ? `₹${kyc.income_declaration.toLocaleString()}` : null} ocr={undefined} />
                  <KYCRow label="Loan Purpose" spoken={kyc.loan_purpose} ocr={undefined} />
                </tbody>
              </table>
            </div>
            {doc && (
              <div className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold border ${doc.is_match ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>
                {doc.is_match ? "✓" : "⚠"} OCR Match Score: <strong>{doc.match_score}%</strong>
              </div>
            )}
          </div>

          {/* Fraud Signals */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
              <AlertTriangle size={13} /> Fraud Signals
            </h2>
            <div className="space-y-2">
              <RiskBadge
                ok={!geo?.is_mismatch}
                label={`Geo/IP Check${geo?.distance_km != null ? ` (${geo.distance_km}km)` : ""}`}
                trueLabel="✓ Locations match" falseLabel="✗ Possible VPN"
              />
              <RiskBadge ok={!kyc.stress_flag} label="Voice Stress / Hesitation" trueLabel="✓ None detected" falseLabel="⚠ Stress detected" />
              <RiskBadge ok={liveness?.passed ?? false} label="Liveness" trueLabel="✓ Verified" falseLabel="✗ Not verified" />
              {offer && (
                <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                  <span className="text-sm text-slate-700 font-medium">Loan offer</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold border ${
                    offer.status === "APPROVED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    offer.status === "REJECTED" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}>{offer.status} {offer.amount ? `· ₹${offer.amount.toLocaleString()}` : ""}</span>
                </div>
              )}
            </div>
          </div>

          {/* Human Override */}
          <div className="rounded-2xl border-2 border-slate-900 bg-slate-900 p-5 sm:p-6">
            <h2 className="mb-1 text-sm font-bold text-white">Human Override Decision</h2>
            <p className="mb-4 text-xs text-slate-400">Your decision overrides the AI recommendation and is permanently logged to the audit trail.</p>

            {reviewDone ? (
              <div className={`rounded-xl px-4 py-4 text-center text-sm font-bold border-2 ${
                reviewDone === "APPROVED" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" :
                reviewDone === "REJECTED" ? "bg-red-500/20 text-red-300 border-red-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"
              }`}>
                ✓ Review saved: {reviewDone}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  onClick={() => doReview("APPROVED")} disabled={reviewing}
                  className="rounded-xl bg-emerald-600 px-2 py-3 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition"
                >
                  {reviewing ? <Loader2 size={14} className="animate-spin mx-auto" /> : "✓ Approve"}
                </button>
                <button
                  onClick={() => doReview("REJECTED")} disabled={reviewing}
                  className="rounded-xl bg-red-600 px-2 py-3 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50 transition"
                >
                  {reviewing ? <Loader2 size={14} className="animate-spin mx-auto" /> : "✗ Reject"}
                </button>
                <button
                  onClick={() => doReview("FLAGGED")} disabled={reviewing}
                  className="rounded-xl bg-amber-600 px-2 py-3 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50 transition"
                >
                  {reviewing ? <Loader2 size={14} className="animate-spin mx-auto" /> : "⚑ Flag"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center" style={{ background: "#060d1a" }}><div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" /></div>}>
      <DashboardInner />
    </Suspense>
  );
}

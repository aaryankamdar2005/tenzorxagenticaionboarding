"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { fetchSessionDetail, updateSessionReview } from "../../../lib/api";
import { AdminSession } from "../../../lib/types";

// ── Circular confidence ring ────────────────────────────────────────────────
function ConfidenceRing({ score }: { score: number }) {
  const r = 68;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(100, Math.max(0, score)) / 100);
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const labelColor = score >= 75 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-rose-400";

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="176" height="176" className="drop-shadow-lg">
        <circle cx="88" cy="88" r={r} fill="none" stroke="#1e293b" strokeWidth="14" />
        <circle cx="88" cy="88" r={r} fill="none" stroke={color} strokeWidth="14"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 88 88)" style={{ transition: "stroke-dashoffset 1.2s ease" }}
        />
        <text x="88" y="82" textAnchor="middle" fill="white" fontSize="28" fontWeight="bold" fontFamily="Inter,sans-serif">{score}%</text>
        <text x="88" y="104" textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="Inter,sans-serif">Confidence</text>
      </svg>
      <p className={`text-sm font-bold ${labelColor}`}>{score >= 75 ? "STRONG APPROVAL" : score >= 50 ? "NEEDS REVIEW" : "HIGH RISK"}</p>
    </div>
  );
}

// ── KYC field row ────────────────────────────────────────────────────────────
function KYCRow({ label, spoken, ocr }: { label: string; spoken?: string | null; ocr?: string | null }) {
  const mismatch = spoken && ocr && spoken.toLowerCase().trim() !== ocr.toLowerCase().trim();
  return (
    <tr className={`border-b border-slate-800 ${mismatch ? "bg-rose-950/20" : ""}`}>
      <td className="py-2.5 pr-4 text-xs text-slate-500 whitespace-nowrap">{label}</td>
      <td className="py-2.5 pr-4 text-sm text-slate-200">{spoken ?? <span className="italic text-slate-600">—</span>}</td>
      <td className={`py-2.5 text-sm ${mismatch ? "text-rose-400 font-semibold" : "text-slate-200"}`}>
        {ocr ?? <span className="italic text-slate-600">—</span>}
        {mismatch && <span className="ml-1 text-xs text-rose-500">⚠ mismatch</span>}
      </td>
    </tr>
  );
}

// ── Risk badge ───────────────────────────────────────────────────────────────
function RiskBadge({ ok, label, trueLabel, falseLabel }: { ok: boolean; label: string; trueLabel?: string; falseLabel?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2.5">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ok ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
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
    <div className="flex min-h-screen items-center justify-center text-slate-400">
      <div className="text-center">
        <p className="mb-3">No session ID provided.</p>
        <Link href="/admin" className="text-cyan-400 underline">← Back to sessions</Link>
      </div>
    </div>
  );

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
    </div>
  );

  if (error || !session) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="max-w-md text-center">
        <p className="text-rose-300 mb-3">{error ?? "Session not found"}</p>
        <Link href="/admin" className="text-cyan-400 underline">← Back to sessions</Link>
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
    <main className="min-h-screen" style={{ background: "#060d1a" }}>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Risk Control Center</p>
            <h1 className="text-base font-semibold text-white">{kyc.full_name ?? "Anonymous Applicant"}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-slate-600">{sessionId?.slice(0, 8)}…</span>
            <Link href="/admin" className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-slate-600 hover:text-white transition">← Sessions</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 xl:grid-cols-[1.2fr_1fr]">

        {/* ── LEFT: Transcript ──────────────────────────────────────────────── */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">Conversation Transcript</h2>
            <div className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
              {session.transcripts && session.transcripts.length > 0 ? session.transcripts.map((t, i) => (
                <div key={i} className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  {t.user && (
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white/50">You</span>
                      <p className="text-sm text-slate-200">{t.user}</p>
                    </div>
                  )}
                  {t.agent && (
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 rounded bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-cyan-400">Aria</span>
                      <p className="text-sm text-cyan-100">{t.agent}</p>
                    </div>
                  )}
                  <p className="text-xs text-slate-700">{t.created_at ? new Date(t.created_at).toLocaleTimeString() : ""}</p>
                </div>
              )) : (
                <p className="py-8 text-center text-sm italic text-slate-600">Transcript not available for this session.</p>
              )}
            </div>
          </div>

          {/* Liveness results */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">Liveness Verification</h2>
            {liveness ? (
              <div className="space-y-2">
                <RiskBadge ok={liveness.passed} label={`Challenge: "${liveness.challenge}"`} trueLabel="✓ Passed" falseLabel="✗ Failed" />
                <div className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2.5">
                  <span className="text-xs text-slate-400">Attempts used</span>
                  <span className={`text-sm font-medium ${liveness.attempts <= 1 ? "text-emerald-300" : liveness.attempts === 2 ? "text-amber-300" : "text-rose-300"}`}>
                    {liveness.attempts} / 3
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm italic text-slate-600">Liveness check not completed for this session.</p>
            )}
          </div>
        </div>

        {/* ── RIGHT: Risk Control Center ─────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Confidence ring */}
          {score ? (
            <div className="flex flex-col items-center rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <ConfidenceRing score={score.confidence_score} />
              <div className={`mt-4 w-full rounded-xl px-4 py-3 text-center text-sm font-bold ${
                score.approval_recommendation === "APPROVE" ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25" :
                score.approval_recommendation === "REJECT"  ? "bg-rose-500/15 text-rose-300 border border-rose-500/25" :
                "bg-amber-500/15 text-amber-300 border border-amber-500/25"
              }`}>
                {score.approval_recommendation === "APPROVE" ? "✓ AI Recommends APPROVAL" :
                 score.approval_recommendation === "REJECT"  ? "✗ AI Recommends REJECTION" :
                 "⚠ Refer for MANUAL REVIEW"}
              </div>
              {score.reasons.length > 0 && (
                <div className="mt-3 w-full space-y-1">
                  {score.reasons.map((r, i) => <p key={i} className="text-xs text-slate-500">• {r}</p>)}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-center">
              <p className="text-sm italic text-slate-600">AI scoring pending — session may still be active.</p>
            </div>
          )}

          {/* KYC vs OCR comparison */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">KYC Data vs Document OCR</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="pb-2 text-left text-xs font-medium text-slate-500 pr-4">Field</th>
                  <th className="pb-2 text-left text-xs font-medium text-slate-500 pr-4">Spoken</th>
                  <th className="pb-2 text-left text-xs font-medium text-slate-500">OCR</th>
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
            {doc && (
              <div className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${doc.is_match ? "bg-emerald-900/30 text-emerald-300" : "bg-amber-900/30 text-amber-300"}`}>
                {doc.is_match ? "✓" : "⚠"} OCR Match Score: <strong>{doc.match_score}%</strong>
              </div>
            )}
          </div>

          {/* Risk flags */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">Fraud Signals</h2>
            <div className="space-y-2">
              <RiskBadge
                ok={!geo?.is_mismatch}
                label={`Geo/IP Check${geo?.distance_km != null ? ` (${geo.distance_km}km)` : ""}`}
                trueLabel="✓ Locations match" falseLabel="✗ Possible VPN"
              />
              <RiskBadge ok={!kyc.stress_flag} label="Voice Stress / Hesitation" trueLabel="✓ None detected" falseLabel="⚠ Stress detected" />
              <RiskBadge ok={liveness?.passed ?? false} label="Liveness" trueLabel="✓ Verified" falseLabel="✗ Not verified" />
              {offer && (
                <div className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2.5">
                  <span className="text-xs text-slate-400">Loan offer</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    offer.status === "APPROVED" ? "bg-emerald-500/20 text-emerald-300" :
                    offer.status === "REJECTED" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"
                  }`}>{offer.status} {offer.amount ? `· ₹${offer.amount.toLocaleString()}` : ""}</span>
                </div>
              )}
            </div>
          </div>

          {/* Human override actions */}
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/30 p-6">
            <h2 className="mb-1 text-sm font-semibold text-slate-300">Human Override</h2>
            <p className="mb-4 text-xs text-slate-500">Your decision overrides the AI recommendation and is logged to the audit trail.</p>

            {reviewDone ? (
              <div className={`rounded-xl px-4 py-3 text-center text-sm font-semibold ${
                reviewDone === "APPROVED" ? "bg-emerald-500/20 text-emerald-300" :
                reviewDone === "REJECTED" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"
              }`}>
                ✓ Review saved: {reviewDone}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button
                  onClick={() => doReview("APPROVED")} disabled={reviewing}
                  className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition shadow-lg shadow-emerald-900/30"
                >
                  ✓ Override & Approve
                </button>
                <button
                  onClick={() => doReview("REJECTED")} disabled={reviewing}
                  className="rounded-xl bg-rose-700 px-4 py-3 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-50 transition shadow-lg shadow-rose-900/30"
                >
                  ✗ Override & Reject
                </button>
                <button
                  onClick={() => doReview("FLAGGED")} disabled={reviewing}
                  className="rounded-xl bg-amber-700 px-4 py-3 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50 transition shadow-lg shadow-amber-900/30"
                >
                  ⚑ Flag for Review
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

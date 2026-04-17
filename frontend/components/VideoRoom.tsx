"use client";

import * as faceapi from "face-api.js";
import { useCallback, useEffect, useRef, useState } from "react";
import MultiDocCapture from "./MultiDocCapture";
import { CHALLENGE_LABELS, LivenessChallenge, pickRandomChallenge, useLiveness } from "../hooks/useLiveness";
import { BackendEvent, DocExtractResult, DocVerifyResult, FinalScore, GeoResult, KYCFields, OfferResult } from "../lib/types";
import {
  ShieldCheck, BadgeCheck, Clock, CheckCircle, AlertTriangle,
  MessageSquare, Info, Mic, Send, XCircle, Loader2, RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:8000";
const WS_URL  = API_URL.replace(/^http/, "ws");

type ConnState = "connecting" | "connected" | "degraded" | "failed";
type Subtitle  = { id: number; speaker: "user" | "agent"; text: string };
let _subId = 0;

function pickMime(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m));
}

function speakText(text: string, bcp47 = "en-US") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = bcp47;
  utt.rate = 0.95;
  window.speechSynthesis.speak(utt);
}

/** Mode: returns most-frequently occurring value in an array */
function modeOf(arr: number[]): number | null {
  if (!arr.length) return null;
  const counts: Record<number, number> = {};
  arr.forEach((v) => (counts[v] = (counts[v] ?? 0) + 1));
  return Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
}

export default function VideoRoom({ sessionId }: { sessionId: string }) {
  const videoRef           = useRef<HTMLVideoElement>(null);
  const canvasRef          = useRef<HTMLCanvasElement>(null);
  const socketRef          = useRef<WebSocket | null>(null);
  const recorderRef        = useRef<MediaRecorder | null>(null);
  const ageTimerRef        = useRef<NodeJS.Timeout | null>(null);
  const livenessIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ageReadingsRef     = useRef<number[]>([]);   // raw readings for client-side mode

  // ── Model & detection state ──────────────────────────────────────────────────
  const [modelsLoaded, setModelsLoaded]   = useState(false);
  const [detectedAge, setDetectedAge]     = useState<number | null>(null);

  // ── Session & KYC state ──────────────────────────────────────────────────────
  const [connState, setConnState]         = useState<ConnState>("connecting");
  const [subtitles, setSubtitles]         = useState<Subtitle[]>([]);
  const [kycFields, setKycFields]         = useState<KYCFields>({});
  const [offer, setOffer]                 = useState<OfferResult | null>(null);
  const [finalScore, setFinalScore]       = useState<FinalScore | null>(null);
  const [geoResult, setGeoResult]         = useState<GeoResult | null>(null);
  const [showMultiDoc, setShowMultiDoc]   = useState(false);
  const [multiDocResults, setMultiDocResults] = useState<Record<string, DocExtractResult>>({});
  const [sessionFailed, setSessionFailed] = useState(false);
  const [isRecording, setIsRecording]     = useState(false);
  const [sessionState, setSessionState]   = useState<string>("INITIALIZED");

  // ── Liveness ─────────────────────────────────────────────────────────────────
  const [liveness, setLiveness] = useState<{
    active: boolean;
    challenge: LivenessChallenge | null;
    attempts: number;
    passed: boolean | null;
  }>({ active: false, challenge: null, attempts: 0, passed: null });

  // ── Manual testing ───────────────────────────────────────────────────────────
  const [manualText, setManualText]       = useState("");

  // ── Submit for review ────────────────────────────────────────────────────────
  const [submitStatus, setSubmitStatus]   = useState<"idle" | "loading" | "done" | "error">("idle");

  const { detectMetrics, isChallengeComplete } = useLiveness();

  // ─────────────────────────────────────────────────────────────────────────────
  // Restore session state on mount / reload
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/sessions/${sessionId}`);
        if (!res.ok) return;
        const data = await res.json();

        // Restore KYC fields
        if (data.latest_extraction) setKycFields(data.latest_extraction);
        if (data.latest_offer)      setOffer(data.latest_offer);
        if (data.final_score)       setFinalScore(data.final_score);
        if (data.state)             setSessionState(data.state);
        if (data.review_status === "SUBMITTED") setSubmitStatus("done");

        // Restore biometric
        if (data.liveness_result) {
          setLiveness(p => ({
            ...p,
            passed: data.liveness_result.passed ?? null,
            attempts: data.liveness_result.attempts ?? 0,
          }));
        }

        // Restore best age
        if (data.best_age_estimate != null) {
          setDetectedAge(data.best_age_estimate);
          ageReadingsRef.current = [data.best_age_estimate];
        }
      } catch { /* not critical */ }
    })();
  }, [sessionId]);

  // ─────────────────────────────────────────────────────────────────────────────
  // WebSocket message handler
  // ─────────────────────────────────────────────────────────────────────────────
  const addSubtitle = useCallback((speaker: "user" | "agent", text: string) => {
    setSubtitles((prev) => [...prev.slice(-20), { id: ++_subId, speaker, text }]);
  }, []);

  const handleWsMessage = useCallback((ev: MessageEvent) => {
    let msg: BackendEvent;
    try { msg = JSON.parse(ev.data as string); } catch { return; }
    const { type, payload } = msg;
    switch (type) {
      case "CONNECTED":         setConnState("connected"); break;
      case "TRANSCRIPT_UPDATE": if (payload?.text) addSubtitle("user",  String(payload.text)); break;
      case "AGENT_REPLY":
        if (payload?.text) {
          const txt = String(payload.text);
          addSubtitle("agent", txt);
          speakText(txt, String(payload.bcp47 ?? "en-US"));
        }
        break;
      case "EXTRACTED_FIELDS":  setKycFields(payload as KYCFields);                        break;
      case "OFFER_READY":       setOffer(payload as unknown as OfferResult);                break;
      case "FINAL_SCORE":       setFinalScore(payload as unknown as FinalScore);            break;
      case "GEO_RESULT":        setGeoResult(payload as unknown as GeoResult);              break;
      case "SESSION_FAILED":    setSessionFailed(true);                                     break;
      case "LIVENESS_ACK":
        if (payload?.passed != null) {
          setLiveness(p => ({ ...p, passed: Boolean(payload.passed) }));
        }
        break;
    }
  }, [addSubtitle]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Main WebSocket + camera + mic + face-api models
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let camera: MediaStream | null = null;
    let mic:    MediaStream | null = null;
    const ws = new WebSocket(`${WS_URL}/ws/${sessionId}`);
    socketRef.current = ws;
    ws.onmessage = handleWsMessage;

    (async () => {
      // Load all face-api models
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
        await faceapi.nets.faceExpressionNet.loadFromUri("/models");
        await faceapi.nets.ageGenderNet.loadFromUri("/models");
        setModelsLoaded(true);
        console.log("[face-api] All models loaded ✓");
      } catch (e) { console.error("Face models failed", e); }

      // Camera + mic
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        camera = new MediaStream(stream.getVideoTracks());
        mic    = new MediaStream(stream.getAudioTracks());
        if (videoRef.current) videoRef.current.srcObject = camera;
      } catch (e) { console.error("Mic/Cam failed", e); }

      if (mic) {
        const mimeType = pickMime();
        const rec = new MediaRecorder(mic, { mimeType });
        rec.ondataavailable = async (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN)
            ws.send(await e.data.arrayBuffer());
        };
        recorderRef.current = rec;
      }
    })();

    return () => {
      camera?.getTracks().forEach(t => t.stop());
      mic?.getTracks().forEach(t => t.stop());
      if (ageTimerRef.current) clearInterval(ageTimerRef.current);
      ws.close();
    };
  }, [sessionId, handleWsMessage]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Age detection loop — every 3 s; tracks mode of readings over last 30
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!modelsLoaded) return;

    ageTimerRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.paused || video.ended) return;
      try {
        const det = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withAgeAndGender();
        if (det && det.age != null) {
          const rounded = Math.round(det.age);
          const readings = ageReadingsRef.current;
          readings.push(rounded);
          if (readings.length > 30) readings.shift();   // rolling window of 30

          const best = modeOf(readings)!;
          setDetectedAge(best);

          socketRef.current?.send(JSON.stringify({
            kind: "age_estimation",
            age_estimation_score: best,
          }));
        }
      } catch { /* ignore per-frame errors */ }
    }, 3000);

    return () => { if (ageTimerRef.current) clearInterval(ageTimerRef.current); };
  }, [modelsLoaded]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Liveness polling loop
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!liveness.active || !liveness.challenge || !modelsLoaded) return;

    livenessIntervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      const metrics = await detectMetrics(video);
      if (!metrics) return;

      if (isChallengeComplete(liveness.challenge!, metrics)) {
        clearInterval(livenessIntervalRef.current!);
        livenessIntervalRef.current = null;
        setLiveness(p => ({ ...p, active: false, passed: true }));
        speakText("Biometric verification complete. Thank you!");
        socketRef.current?.send(JSON.stringify({
          kind: "liveness_result",
          challenge: liveness.challenge,
          passed: true,
          attempts: liveness.attempts + 1,
        }));
      }
    }, 400);

    // Auto-fail after 15 s
    const timeout = setTimeout(() => {
      clearInterval(livenessIntervalRef.current!);
      livenessIntervalRef.current = null;
      setLiveness(p => ({ ...p, active: false, passed: false, attempts: p.attempts + 1 }));
      socketRef.current?.send(JSON.stringify({
        kind: "liveness_result",
        challenge: liveness.challenge,
        passed: false,
        attempts: liveness.attempts + 1,
      }));
    }, 15000);

    return () => {
      clearInterval(livenessIntervalRef.current!);
      clearTimeout(timeout);
    };
  }, [liveness.active, liveness.challenge, modelsLoaded, detectMetrics, isChallengeComplete]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────
  const startRec = () => { if (recorderRef.current?.state === "inactive") { recorderRef.current.start(); setIsRecording(true); }  };
  const stopRec  = () => { if (recorderRef.current?.state === "recording") { recorderRef.current.stop(); setIsRecording(false); } };

  const startLiveness = () => {
    const c = pickRandomChallenge();
    speakText(`Verification Step: ${CHALLENGE_LABELS[c]}`);
    setLiveness(p => ({ ...p, active: true, challenge: c, passed: null }));
  };

  const sendManual = () => {
    if (!manualText.trim()) return;
    socketRef.current?.send(JSON.stringify({ kind: "manual_transcript", text: manualText }));
    setManualText("");
  };

  const submitForReview = async () => {
    setSubmitStatus("loading");
    try {
      const res = await fetch(`${API_URL}/api/sessions/${sessionId}/submit`, { method: "POST" });
      if (res.ok) { setSubmitStatus("done"); setSessionState("SUBMITTED"); }
      else setSubmitStatus("error");
    } catch { setSubmitStatus("error"); }
  };

  const agentReply = subtitles.filter(s => s.speaker === "agent").pop()?.text;
  const userText   = subtitles.filter(s => s.speaker === "user").pop()?.text;

  // ─────────────────────────────────────────────────────────────────────────────
  //  Readability helpers
  // ─────────────────────────────────────────────────────────────────────────────
  const livenessBadge = () => {
    if (liveness.passed === true)  return { cls: "bg-emerald-100 text-emerald-800 border border-emerald-300", label: "PASSED ✓" };
    if (liveness.passed === false) return { cls: "bg-red-100 text-red-800 border border-red-300",             label: "FAILED ✗" };
    return { cls: "bg-slate-100 text-slate-600 border border-slate-300",            label: "PENDING" };
  };

  const docBadge = () => {
    if (Object.keys(multiDocResults).length > 0) return { cls: "bg-emerald-100 text-emerald-800 border border-emerald-300", label: "COMPLETE ✓" };
    return { cls: "bg-slate-100 text-slate-600 border border-slate-300", label: "AWAITING" };
  };

  const lb = livenessBadge();
  const db = docBadge();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pt-6 px-6">
      {showMultiDoc && (
        <MultiDocCapture
          sessionId={sessionId}
          videoRef={videoRef}
          spokenName={kycFields.full_name}
          spokenDob={kycFields.dob}
          onResult={(docType, result) => setMultiDocResults(prev => ({ ...prev, [docType]: result }))}
          onClose={() => setShowMultiDoc(false)}
        />
      )}

      <div className="mx-auto max-w-7xl">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">SecureBank Core</p>
              <h1 className="text-xl font-bold text-slate-900">Identity Verification Session</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {detectedAge && (
              <div className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-1.5 text-white">
                <BadgeCheck size={14} />
                <span className="text-[11px] font-bold uppercase tracking-widest">Est. Age: {detectedAge}Y</span>
              </div>
            )}
            <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 border ${isRecording ? "bg-emerald-100 border-emerald-400 text-emerald-800" : "bg-white border-slate-300 text-slate-600"}`}>
              <div className={`h-2 w-2 rounded-full ${isRecording ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
              <span className="text-[10px] font-bold uppercase tracking-widest">{isRecording ? "Listening" : "Connected"}</span>
            </div>
          </div>
        </div>

        {/* ── Submitted Banner ── */}
        <AnimatePresence>
          {submitStatus === "done" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-6 flex items-center gap-3 rounded-xl bg-blue-600 px-6 py-4 text-white shadow-md"
            >
              <CheckCircle size={20} />
              <div>
                <p className="font-bold">Application Submitted for Review</p>
                <p className="text-sm text-blue-200">A banker will review your KYC session and contact you shortly.</p>
              </div>
            </motion.div>
          )}
          {sessionFailed && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex items-center gap-3 rounded-xl bg-red-700 px-6 py-4 text-white shadow-md"
            >
              <XCircle size={20} />
              <div>
                <p className="font-bold">Session Terminated</p>
                <p className="text-sm text-red-200">Biometric verification failed after maximum attempts.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* ── Left: Video + Transcript ── */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Video */}
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-900 shadow-lg border border-slate-300">
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
              <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

              {/* Liveness overlay */}
              <AnimatePresence>
                {liveness.active && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-[2px]">
                    <div className="rounded-2xl bg-white p-8 shadow-2xl border border-slate-200 max-w-sm w-full text-center">
                      <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">Biometric Challenge</p>
                      <p className="text-2xl font-bold text-slate-900 mb-6">{CHALLENGE_LABELS[liveness.challenge!]}</p>
                      <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: "100%" }}
                          transition={{ duration: 15 }} className="h-full bg-blue-600" />
                      </div>
                      <p className="text-xs text-slate-500 mt-3">Complete the gesture before the timer ends</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mic button */}
              <div className="absolute inset-x-0 bottom-6 flex justify-center px-6">
                <button
                  onPointerDown={startRec} onPointerUp={stopRec} onPointerLeave={stopRec}
                  className={`flex items-center gap-3 rounded-full px-8 py-4 font-bold shadow-xl transition-all active:scale-95 ${
                    isRecording
                      ? "bg-red-600 text-white scale-105"
                      : "bg-white text-slate-900 hover:bg-slate-50 border border-slate-200"
                  }`}
                >
                  <Mic size={20} />
                  {isRecording ? "RELEASE TO SUBMIT" : "HOLD TO RESPOND"}
                </button>
              </div>

              {/* Age HUD tag */}
              <div className="absolute top-4 left-4">
                <div className="rounded-full bg-slate-900/70 backdrop-blur-md px-3 py-1.5 border border-white/20 text-[10px] font-bold text-white flex items-center gap-2">
                  <div className={`h-1.5 w-1.5 rounded-full ${modelsLoaded ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
                  {modelsLoaded ? (detectedAge ? `Age: ${detectedAge}Y` : "Detecting face...") : "Loading models..."}
                </div>
              </div>

              {/* Biometric result floating badge */}
              {!liveness.active && liveness.passed !== null && (
                <div className={`absolute top-4 right-4 rounded-full px-3 py-1.5 text-[10px] font-bold flex items-center gap-2 ${
                  liveness.passed
                    ? "bg-emerald-600 text-white"
                    : "bg-red-600 text-white"
                }`}>
                  {liveness.passed ? <CheckCircle size={12} /> : <XCircle size={12} />}
                  Biometric {liveness.passed ? "Passed" : "Failed"}
                </div>
              )}
            </div>

            {/* Transcript Console */}
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col h-52">
              <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-700 font-bold uppercase tracking-widest text-[10px]">
                  <MessageSquare size={12} /> Live Support Assistant
                </div>
                {isRecording && (
                  <span className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-blue-600 animate-bounce" />
                    <span className="h-2 w-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]" />
                  </span>
                )}
              </div>
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                <AnimatePresence mode="popLayout">
                  {agentReply && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                      <div className="shrink-0 h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">A</div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 leading-relaxed">{agentReply}</p>
                      </div>
                    </motion.div>
                  )}
                  {userText && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 flex-row-reverse">
                      <div className="shrink-0 h-8 w-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">U</div>
                      <div className="text-right">
                        <p className="text-sm italic text-slate-700 leading-relaxed">{userText}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {!agentReply && !userText && (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs gap-2">
                    <Info size={14} /> Establishing secure communication...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right: Sidebar ── */}
          <div className="lg:col-span-4 flex flex-col gap-5">

            {/* KYC Fields */}
            <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                <BadgeCheck size={14} className="text-blue-600" /> KYC Information
              </h3>
              <div className="space-y-2">
                {[
                  ["Full Name",       kycFields.full_name],
                  ["Date of Birth",   kycFields.dob],
                  ["Employment",      kycFields.employer],
                  ["Tenure",          kycFields.tenure_at_employer],
                  ["Monthly Income",  kycFields.income_declaration  ? `₹${Number(kycFields.income_declaration).toLocaleString()}` : null],
                  ["Existing EMIs",   kycFields.monthly_emi_obligations ? `₹${Number(kycFields.monthly_emi_obligations).toLocaleString()}` : null],
                  ["Residency",       kycFields.property_ownership],
                  ["Loan Purpose",    kycFields.loan_purpose],
                  ["Est. Age (Face)", detectedAge ? `${detectedAge} years` : null],
                ].map(([label, val]) => (
                  <div key={label as string} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <span className="text-xs text-slate-500 font-medium">{label}</span>
                    <span className={`text-xs font-bold ${val ? "text-slate-900" : "text-slate-300"}`}>
                      {val || "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Checks */}
            <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                <CheckCircle size={14} className="text-blue-600" /> Security Checks
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Biometric Liveness</span>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${lb.cls}`}>
                    {lb.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Document Authenticity</span>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${db.cls}`}>
                    {db.label}
                  </span>
                </div>
                {liveness.attempts > 0 && (
                  <p className="text-[10px] text-slate-400 pt-1">Biometric attempts: {liveness.attempts}</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button onClick={() => setShowMultiDoc(true)}
                className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white hover:bg-blue-700 transition shadow-sm">
                Verify Proof of Identity
              </button>
              <button
                onClick={startLiveness}
                disabled={liveness.passed === true || liveness.active}
                className={`w-full rounded-xl py-3.5 text-sm font-bold transition border ${
                  liveness.passed === true
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700 cursor-default"
                    : liveness.active
                    ? "bg-slate-50 border-slate-200 text-slate-400 cursor-wait"
                    : "bg-white border-blue-600 text-blue-600 hover:bg-blue-50"
                }`}
              >
                {liveness.active ? "Challenge Active..." : liveness.passed === true ? "✓ Biometric Passed" : "Initiate Biometric Check"}
              </button>

              {/* Submit for Review button */}
              <button
                onClick={submitForReview}
                disabled={submitStatus === "done" || submitStatus === "loading"}
                className={`w-full rounded-xl py-3.5 text-sm font-bold transition flex items-center justify-center gap-2 ${
                  submitStatus === "done"
                    ? "bg-emerald-100 border border-emerald-300 text-emerald-800 cursor-default"
                    : submitStatus === "error"
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
                }`}
              >
                {submitStatus === "loading" && <Loader2 size={16} className="animate-spin" />}
                {submitStatus === "done"    && <CheckCircle size={16} />}
                {submitStatus === "error"   && <RefreshCw size={16} />}
                {submitStatus === "idle"    && <Send size={16} />}
                {submitStatus === "done"    ? "Submitted for Review"
                  : submitStatus === "loading" ? "Submitting..."
                  : submitStatus === "error"   ? "Retry Submit"
                  : "Submit for Banker Review"}
              </button>
            </div>

            {/* Manual Testing Section */}
            <div className="rounded-2xl bg-white border border-dashed border-slate-300 p-5">
              <h4 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                <Clock size={12} /> QA &amp; Manual Testing
              </h4>
              <div className="flex flex-col gap-2.5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="Type manual answer..."
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    onKeyDown={(e) => { if (e.key === "Enter") sendManual(); }}
                  />
                  <button
                    onClick={sendManual}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-700 transition flex items-center gap-1 text-xs font-bold"
                  >
                    <Send size={13} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => socketRef.current?.send(JSON.stringify({ kind: "manual_transcript", text: "My name is John Doe, I am 32 years old and I work for TechCorp as a software engineer." }))}
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-2 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 transition"
                  >
                    Auto Fill Info
                  </button>
                  <button
                    onClick={() => socketRef.current?.send(JSON.stringify({ kind: "manual_transcript", text: "I give my full consent to proceed with this loan application." }))}
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-2 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 transition"
                  >
                    Quick Consent
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

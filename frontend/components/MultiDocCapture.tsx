"use client";
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { extractDocument } from "../lib/api";
import { DocExtractResult } from "../lib/types";
import { Camera, Upload, CheckCircle, AlertCircle, FileText, X, Loader } from "lucide-react";

const DOC_TYPES = [
  { id: "pan",            label: "PAN Card",       icon: "🪪", desc: "Permanent Account Number" },
  { id: "aadhaar",        label: "Aadhaar Card",   icon: "🏛️", desc: "12-digit UID card" },
  { id: "bank_statement", label: "Bank Statement", icon: "🏦", desc: "Last 3 months required" },
  { id: "payslip",        label: "Payslip",        icon: "📋", desc: "Last month's salary slip" },
] as const;

type DocTypeId = typeof DOC_TYPES[number]["id"];

interface Props {
  sessionId: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  spokenName?: string | null;
  spokenDob?: string | null;
  onResult: (docType: string, result: DocExtractResult) => void;
  onClose: () => void;
}

export default function MultiDocCapture({ sessionId, videoRef, spokenName, spokenDob, onResult, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeDoc, setActiveDoc] = useState<DocTypeId>("pan");
  const [mode, setMode] = useState<"camera" | "upload">("upload");
  const [captured, setCaptured] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, DocExtractResult>>({});

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) return;
      setCapturedBlob(blob);
      setCaptured(URL.createObjectURL(blob));
      setError(null);
    }, "image/jpeg", 0.92);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file."); return; }
    if (file.size > 15 * 1024 * 1024) { setError("File too large (max 15 MB)."); return; }
    setCapturedBlob(file);
    setCaptured(URL.createObjectURL(file));
    setError(null);
  };

  const submit = async () => {
    if (!capturedBlob) return;
    setLoading(true);
    setError(null);
    try {
      const result = await extractDocument(sessionId, capturedBlob, activeDoc, spokenName, spokenDob);
      if (result.error) {
        setError(result.error);
      } else {
        setResults(prev => ({ ...prev, [activeDoc]: result }));
        onResult(activeDoc, result);
        setCaptured(null);
        setCapturedBlob(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setCaptured(null); setCapturedBlob(null); setError(null); };

  const currentResult = results[activeDoc];
  const isIdentityDoc = activeDoc === "pan" || activeDoc === "aadhaar";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-2xl rounded-2xl border border-cyan-500/20 bg-slate-950 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="font-semibold text-cyan-100">Multi-Document Verification</h2>
            <p className="text-xs text-slate-500 mt-0.5">AI-powered OCR + LLM extraction</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:text-white transition"><X size={18} /></button>
        </div>

        <div className="flex">
          {/* Sidebar — doc type selector */}
          <div className="w-44 border-r border-slate-800 p-3 space-y-1.5 shrink-0">
            {DOC_TYPES.map(doc => {
              const done = !!results[doc.id];
              return (
                <button key={doc.id} onClick={() => { setActiveDoc(doc.id as DocTypeId); reset(); }}
                  className={`w-full text-left rounded-xl px-3 py-2.5 transition text-sm ${
                    activeDoc === doc.id
                      ? "bg-electric-cyan/10 border border-electric-cyan/30 text-white"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                  }`}>
                  <div className="flex items-center justify-between">
                    <span>{doc.icon} {doc.label}</span>
                    {done && <CheckCircle size={12} className="text-emerald-400" />}
                  </div>
                  <p className="text-[10px] text-slate-600 mt-0.5">{doc.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Main content */}
          <div className="flex-1 p-5 space-y-4 min-w-0">
            {/* Mode tabs */}
            <div className="flex gap-2">
              {(["upload", "camera"] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); reset(); }}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    mode === m ? "border border-electric-cyan/40 bg-electric-cyan/10 text-electric-cyan" 
                    : "border border-slate-700 text-slate-500 hover:text-slate-300"
                  }`}>
                  {m === "upload" ? <Upload size={12} /> : <Camera size={12} />}
                  {m === "upload" ? "Upload File" : "Camera Capture"}
                </button>
              ))}
            </div>

            {/* Tips */}
            {!captured && (
              <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-3 text-xs text-slate-500 space-y-1">
                <p className="font-medium text-slate-400">📋 Tips for accurate extraction:</p>
                <ul className="list-disc ml-4 space-y-0.5">
                  <li>Ensure document is flat, fully visible, and well-lit</li>
                  <li>Avoid glare or shadows on the text</li>
                  <li>Use the highest resolution image available</li>
                </ul>
              </div>
            )}

            {/* File upload */}
            {mode === "upload" && !captured && (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" id="multi-doc-upload" />
                <label htmlFor="multi-doc-upload"
                  className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-700 py-8 hover:border-electric-cyan/40 hover:bg-electric-cyan/5 transition">
                  <Upload size={28} className="text-slate-600" />
                  <span className="text-sm text-slate-400">Click to choose image</span>
                  <span className="text-xs text-slate-600">JPG · PNG · WEBP · up to 15 MB</span>
                </label>
              </>
            )}

            {/* Camera capture */}
            {mode === "camera" && !captured && (
              <button onClick={captureFrame}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900/50 py-8 text-sm text-slate-300 hover:border-electric-cyan/40 hover:text-white transition">
                <Camera size={20} /> Capture Frame from Camera
              </button>
            )}

            {/* Preview */}
            {captured && (
              <div className="overflow-hidden rounded-xl border border-slate-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={captured} alt="Document" className="w-full max-h-48 object-contain bg-black" />
              </div>
            )}

            {/* Result */}
            {currentResult && (
              <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  {currentResult.is_match
                    ? <CheckCircle size={16} className="text-emerald-400" />
                    : <AlertCircle size={16} className="text-amber-400" />}
                  <span className={`text-sm font-medium ${currentResult.is_match ? "text-emerald-300" : "text-amber-300"}`}>
                    {currentResult.is_match ? "Document verified ✓" : "Verification incomplete"}
                  </span>
                  {isIdentityDoc && (
                    <span className={`ml-auto text-lg font-bold ${currentResult.match_score >= 80 ? "text-emerald-400" : currentResult.match_score >= 60 ? "text-amber-400" : "text-red-400"}`}>
                      {currentResult.match_score.toFixed(0)}%
                    </span>
                  )}
                </div>

                {/* Extracted fields */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {isIdentityDoc && (
                    <>
                      <div><p className="text-slate-500 mb-0.5">Extracted Name</p><p className="text-slate-200">{currentResult.extracted.name ?? <span className="italic text-slate-600">Not found</span>}</p></div>
                      <div><p className="text-slate-500 mb-0.5">Extracted DOB</p><p className="text-slate-200">{currentResult.extracted.dob ?? <span className="italic text-slate-600">Not found</span>}</p></div>
                      {currentResult.extracted.id_number && (
                        <div className="col-span-2"><p className="text-slate-500 mb-0.5">ID Number</p><p className="font-mono text-electric-cyan">{currentResult.extracted.id_number}</p></div>
                      )}
                    </>
                  )}
                  {!isIdentityDoc && currentResult.extracted.verified_monthly_income && (
                    <div className="col-span-2">
                      <p className="text-slate-500 mb-0.5">Verified Monthly Income</p>
                      <p className="text-xl font-bold text-emerald-400">₹{currentResult.extracted.verified_monthly_income.toLocaleString()}</p>
                      {currentResult.extracted.bank_name && <p className="text-slate-500 mt-0.5">{currentResult.extracted.bank_name}</p>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && <p className="rounded-lg bg-red-900/20 border border-red-500/30 px-3 py-2 text-xs text-red-300">{error}</p>}

            {/* Hidden canvas */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Actions */}
            <div className="flex gap-3">
              {captured && !currentResult && (
                <>
                  <button onClick={reset} className="flex-1 rounded-xl border border-slate-600 py-2.5 text-sm text-slate-300 hover:bg-slate-800 transition">
                    {mode === "camera" ? "Retake" : "Choose different"}
                  </button>
                  <button onClick={submit} disabled={loading}
                    className="flex-1 rounded-xl bg-electric-cyan/10 border border-electric-cyan/30 py-2.5 text-sm font-semibold text-electric-cyan hover:bg-electric-cyan/20 transition disabled:opacity-50 flex items-center justify-center gap-2">
                    {loading ? <><Loader size={14} className="animate-spin" /> Extracting…</> : "🔍 Extract with AI"}
                  </button>
                </>
              )}
              {currentResult && (
                <button onClick={reset} className="flex-1 rounded-xl border border-slate-600 py-2.5 text-sm text-slate-300 hover:bg-slate-800 transition">
                  Scan another {DOC_TYPES.find(d => d.id === activeDoc)?.label}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Progress footer */}
        <div className="border-t border-slate-800 px-6 py-3 flex items-center justify-between">
          <div className="flex gap-2">
            {DOC_TYPES.map(d => (
              <div key={d.id} className={`h-1.5 w-8 rounded-full transition-all ${results[d.id] ? "bg-electric-cyan" : "bg-slate-700"}`} />
            ))}
          </div>
          <p className="text-xs text-slate-600">{Object.keys(results).length}/{DOC_TYPES.length} documents verified</p>
        </div>
      </motion.div>
    </div>
  );
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden flex flex-col md:flex-row">

        {/* Sidebar */}
        <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-gray-100 bg-gray-50 p-4 space-y-2 shrink-0">
          <div className="mb-4 hidden md:block">
            <h2 className="font-bold text-gray-900">Verification</h2>
            <p className="text-[11px] text-gray-500">AI-powered extraction</p>
          </div>
          {DOC_TYPES.map(doc => {
            const done = !!results[doc.id];
            return (
              <button key={doc.id} onClick={() => { setActiveDoc(doc.id as DocTypeId); reset(); }}
                className={`w-full text-left rounded-lg px-3 py-3 transition text-sm font-medium ${
                  activeDoc === doc.id
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-200"
                }`}>
                <div className="flex items-center justify-between">
                  <span>{doc.icon} {doc.label}</span>
                  {done && <CheckCircle size={14} className={activeDoc === doc.id ? "text-white" : "text-green-600"} />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Main content */}
        <div className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-lg">{DOC_TYPES.find(d => d.id === activeDoc)?.label}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-900"><X size={20} /></button>
          </div>

          <div className="flex gap-2">
            {(["upload", "camera"] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); reset(); }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  mode === m ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {m === "upload" ? <Upload size={16} /> : <Camera size={16} />}
                {m === "upload" ? "Upload" : "Camera"}
              </button>
            ))}
          </div>

          {!captured && (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center text-center">
              {mode === "upload" ? (
                <>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" id="upload" />
                  <label htmlFor="upload" className="cursor-pointer text-blue-600 font-semibold">Browse files</label>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 15MB</p>
                </>
              ) : (
                <button onClick={captureFrame} className="text-blue-600 font-semibold">Open Camera</button>
              )}
            </div>
          )}

          {captured && (
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <img src={captured} alt="Preview" className="w-full h-48 object-cover" />
            </div>
          )}

          {currentResult && (
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <p className="text-sm font-bold text-gray-900 mb-2">Extraction Results</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-gray-500 text-xs">Name</p><p className="text-gray-900">{currentResult.extracted.name || "-"}</p></div>
                <div><p className="text-gray-500 text-xs">DOB</p><p className="text-gray-900">{currentResult.extracted.dob || "-"}</p></div>
              </div>
            </div>
          )}

          {error && <p className="text-red-600 text-xs bg-red-50 p-3 rounded-lg">{error}</p>}

          <div className="flex gap-3">
            {captured && !currentResult && (
              <button onClick={submit} disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2">
                {loading ? <Loader className="animate-spin" size={18} /> : "Verify Document"}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

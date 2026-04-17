"use client";

import { useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type InputMode = "camera" | "upload";

interface VerifyResult {
  ocr_name?: string | null;
  ocr_dob?: string | null;
  match_score: number;
  is_match: boolean;
  ocr_raw_text?: string | null;
}

interface Props {
  sessionId: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  spokenName?: string | null;
  spokenDob?: string | null;
  onResult: (result: VerifyResult) => void;
  onClose: () => void;
}

export default function DocumentCapture({
  sessionId, videoRef, spokenName, spokenDob, onResult, onClose,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<InputMode>("camera");
  const [captured, setCaptured] = useState<string | null>(null);       // data URL for preview
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null); // raw blob to send
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);

  // ── Camera capture ─────────────────────────────────────────────────────────
  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        setCaptured(URL.createObjectURL(blob));
        setResult(null);
        setError(null);
      },
      "image/jpeg",
      0.92,
    );
  };

  // ── File upload ────────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (JPG, PNG, WEBP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large. Maximum size is 10 MB.");
      return;
    }
    setCapturedBlob(file);
    setCaptured(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  };

  // ── Send to OCR backend ────────────────────────────────────────────────────
  const submitToOCR = async () => {
    if (!capturedBlob) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", capturedBlob, "document.jpg");
      formData.append("session_id", sessionId);
      if (spokenName) formData.append("spoken_name", spokenName);
      if (spokenDob) formData.append("spoken_dob", spokenDob);

      const res = await fetch(`${API_URL}/api/verify-document`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { detail?: string };
        throw new Error(err.detail ?? `Server error ${res.status}`);
      }

      const data = (await res.json()) as VerifyResult & { error?: string };
      if (data.error) {
        setError(`OCR Unavailable: ${data.error}`);
      } else {
        setResult(data);
        onResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "OCR verification failed");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setCaptured(null);
    setCapturedBlob(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const scoreColor =
    (result?.match_score ?? 0) >= 80 ? "text-emerald-400" :
    (result?.match_score ?? 0) >= 50 ? "text-amber-400" : "text-rose-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-cyan-500/25 bg-slate-950 shadow-2xl shadow-cyan-900/20">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-cyan-100">Document Verification</h2>
            <p className="mt-0.5 text-xs text-slate-400">PAN Card · Aadhaar Card · Voter ID · Passport</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:text-white transition">✕</button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-slate-800">
          {(["camera", "upload"] as InputMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); reset(); }}
              className={`flex-1 py-2.5 text-sm font-medium transition ${
                mode === m
                  ? "border-b-2 border-cyan-500 text-cyan-300"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {m === "camera" ? "📸 Camera Capture" : "📁 Upload Image"}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">
          {/* Tips */}
          {!captured && (
            <div className="rounded-xl border border-cyan-500/15 bg-cyan-900/15 p-3 text-xs text-cyan-300/80 space-y-1">
              <p className="font-semibold text-cyan-200">📋 Tips for best OCR accuracy:</p>
              <ul className="ml-3 list-disc space-y-0.5">
                <li>Card must be flat, fully visible, and well-lit</li>
                <li>Avoid glare — angle the card slightly if needed</li>
                <li>Use a clear, high-resolution image</li>
              </ul>
            </div>
          )}

          {/* Camera mode controls */}
          {mode === "camera" && !captured && (
            <button
              onClick={captureFrame}
              className="w-full rounded-xl bg-cyan-600 py-3 text-sm font-semibold text-white hover:bg-cyan-500 transition"
            >
              📸 Capture Frame from Camera
            </button>
          )}

          {/* Upload mode controls */}
          {mode === "upload" && !captured && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="doc-upload-input"
              />
              <label
                htmlFor="doc-upload-input"
                className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-700 py-8 hover:border-cyan-500/50 hover:bg-cyan-900/10 transition"
              >
                <span className="text-4xl">📁</span>
                <span className="text-sm font-medium text-slate-300">Click to choose a photo</span>
                <span className="text-xs text-slate-500">JPG, PNG, WEBP · up to 10 MB</span>
              </label>
            </div>
          )}

          {/* Preview */}
          {captured && (
            <div className="overflow-hidden rounded-xl border border-slate-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={captured} alt="Document preview" className="w-full object-contain max-h-60" />
            </div>
          )}

          {/* OCR result */}
          {result && (
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">Match Score</span>
                <span className={`text-2xl font-bold ${scoreColor}`}>{result.match_score.toFixed(0)}%</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">OCR — Name</p>
                  <p className="text-slate-200">{result.ocr_name || <span className="italic text-slate-600">Not found</span>}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">OCR — Date of Birth</p>
                  <p className="text-slate-200">{result.ocr_dob || <span className="italic text-slate-600">Not found</span>}</p>
                </div>
              </div>
              {spokenName && (
                <div className="grid grid-cols-2 gap-3 text-sm border-t border-slate-800 pt-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Spoken — Name</p>
                    <p className="text-slate-400">{spokenName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Spoken — DOB</p>
                    <p className="text-slate-400">{spokenDob || "—"}</p>
                  </div>
                </div>
              )}
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                result.is_match ? "bg-emerald-900/40 text-emerald-300" : "bg-amber-900/40 text-amber-300"
              }`}>
                {result.is_match ? "✓ Document matches verbal KYC" : "⚠ Mismatch — flagged for manual review"}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="rounded-lg bg-rose-900/30 px-3 py-2 text-sm text-rose-300">{error}</p>
          )}

          {/* Hidden canvas for camera capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Action buttons */}
          <div className="flex gap-3">
            {!captured ? null : result ? (
              <button onClick={onClose} className="flex-1 rounded-xl bg-emerald-700 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition">
                Done ✓
              </button>
            ) : (
              <>
                <button onClick={reset} className="flex-1 rounded-xl border border-slate-600 py-2.5 text-sm text-slate-300 hover:bg-slate-800 transition">
                  {mode === "camera" ? "Retake" : "Choose different"}
                </button>
                <button
                  onClick={submitToOCR}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-cyan-600 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50 transition"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Verifying…
                    </span>
                  ) : "🔍 Verify with OCR"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

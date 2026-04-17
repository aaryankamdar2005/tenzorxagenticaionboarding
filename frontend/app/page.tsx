"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import SecureBackground from "../components/SecureBackground";
import { ShieldCheck, ArrowRight, Lock, BadgeCheck, FileCheck } from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleStart = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      router.push("/login");
    }, 800);
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
      {/* Dynamic 3D Background */}
      <SecureBackground />

      <div className="relative z-10 w-full max-w-4xl px-6">
        <AnimatePresence>
          {!isTransitioning && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="w-full bg-bg-surface rounded-2xl shadow-xl border border-border-subtle overflow-hidden"
            >
              <div className="md:flex">
                {/* Left Side: Professional Welcome */}
                <div className="md:w-3/5 p-10 md:p-14">
                  <div className="flex items-center gap-2 mb-6 text-brand-blue">
                    <ShieldCheck size={24} />
                    <span className="text-xs font-bold uppercase tracking-[0.2em]">SecureBank Onboarding</span>
                  </div>

                  <h1 className="text-4xl md:text-5xl font-bold text-brand-navy leading-tight mb-6">
                    Professional Digital <br />
                    <span className="text-brand-blue">Identity Verification.</span>
                  </h1>

                  <p className="text-slate-600 text-lg mb-10 leading-relaxed">
                    Welcome to SecureBank's digital onboarding portal. Please have your **PAN** and **Aadhaar** cards ready for the video KYC process. Our system ensures absolute security and regulatory compliance.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      onClick={handleStart}
                      className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-brand-blue text-white font-semibold rounded-full hover:bg-blue-700 transition shadow-md hover:shadow-lg active:transform active:scale-95"
                    >
                      Begin Application <ArrowRight size={18} />
                    </button>
                    <a 
                      href="/banker/login" 
                      className="inline-flex items-center justify-center px-8 py-4 border border-border-subtle text-brand-navy font-semibold rounded-full hover:bg-slate-50 transition"
                    >
                      Banker Access
                    </a>
                  </div>
                </div>

                {/* Right Side: Trust Signals */}
                <div className="md:w-2/5 bg-slate-50 p-10 border-l border-border-subtle flex flex-col justify-center gap-8">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-white rounded-lg shadow-sm border border-border-subtle">
                      <Lock size={20} className="text-slate-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-brand-navy">End-to-End Encryption</h3>
                      <p className="text-xs text-slate-500 mt-1">All biometric data and documents are encrypted during transmission.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-white rounded-lg shadow-sm border border-border-subtle">
                      <BadgeCheck size={20} className="text-slate-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-brand-navy">Regulatory Compliant</h3>
                      <p className="text-xs text-slate-500 mt-1">Full adherence to RBI and central banking digital KYC guidelines.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-white rounded-lg shadow-sm border border-border-subtle">
                      <FileCheck size={20} className="text-slate-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-brand-navy">Automated Auditing</h3>
                      <p className="text-xs text-slate-500 mt-1">Every verification step is logged in our secure audit trail.</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <div className="inline-block w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-white/60 text-sm font-medium">Establishing secure connection...</p>
          </motion.div>
        )}
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <p className="text-white/30 text-[10px] font-bold uppercase tracking-[0.3em]">
          Powered by SecureBank Infrastructure
        </p>
      </div>
    </main>
  );
}

"use client";

import React, { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot,
} from "@/components/ui/input-otp";
import { ShieldCheck, Loader2, RotateCcw, ArrowLeft } from "lucide-react";
import Link from "next/link";

export function OTPForm({ className, ...props }: React.ComponentProps<"div">) {
  const [otp,        setOtp]        = useState("");
  const [loading,    setLoading]    = useState(false);
  const [resending,  setResending]  = useState(false);
  const [resent,     setResent]     = useState(false);
  const [countdown,  setCountdown]  = useState(0);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) return;
    setLoading(true);
    // TODO: hook up to your verify API
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    // TODO: hook up to your resend API
    await new Promise((r) => setTimeout(r, 1000));
    setResending(false);
    setResent(true);

    // 60 second cooldown
    setCountdown(60);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          setResent(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <>
      {/* Grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] z-0 pointer-events-none" />

      <div className={cn("relative z-10 flex items-center justify-center min-h-screen px-4", className)} {...props}>
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl px-8 py-10 space-y-6 animate-in fade-in-0 zoom-in-95 duration-300">

            {/* Back link */}
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ArrowLeft size={12} /> Back to login
            </Link>

            {/* Header */}
            <div className="space-y-1">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 mb-4">
                <ShieldCheck size={22} className="text-indigo-500" />
              </div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                Verify your identity
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                We sent a 6-digit verification code to your email address. Enter it below to continue.
              </p>
            </div>

            {/* OTP form */}
            <form onSubmit={handleVerify} className="space-y-5">

              {/* OTP input */}
              <div className="flex flex-col items-center gap-3">
                <InputOTP
                  maxLength={6}
                  id="otp"
                  value={otp}
                  onChange={setOtp}
                  required
                  containerClassName="gap-3"
                >
                  <InputOTPGroup className="gap-2 *:data-[slot=input-otp-slot]:h-14 *:data-[slot=input-otp-slot]:w-11 *:data-[slot=input-otp-slot]:rounded-xl *:data-[slot=input-otp-slot]:border *:data-[slot=input-otp-slot]:border-slate-200 *:data-[slot=input-otp-slot]:bg-slate-50 *:data-[slot=input-otp-slot]:text-lg *:data-[slot=input-otp-slot]:font-bold *:data-[slot=input-otp-slot]:text-slate-800 *:data-[slot=input-otp-slot]:transition-all">
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup className="gap-2 *:data-[slot=input-otp-slot]:h-14 *:data-[slot=input-otp-slot]:w-11 *:data-[slot=input-otp-slot]:rounded-xl *:data-[slot=input-otp-slot]:border *:data-[slot=input-otp-slot]:border-slate-200 *:data-[slot=input-otp-slot]:bg-slate-50 *:data-[slot=input-otp-slot]:text-lg *:data-[slot=input-otp-slot]:font-bold *:data-[slot=input-otp-slot]:text-slate-800 *:data-[slot=input-otp-slot]:transition-all">
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>

                {/* Progress dots */}
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <span
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-200
                        ${i < otp.length ? "bg-indigo-500 scale-110" : "bg-slate-200"}`}
                    />
                  ))}
                </div>
              </div>

              {/* Resend */}
              <div className="flex items-center justify-center gap-1.5 text-[11px]">
                <span className="text-slate-400">Didn't receive the code?</span>
                {resent ? (
                  <span className="text-emerald-600 font-semibold">
                    Code resent ✓
                    {countdown > 0 && <span className="text-slate-400 font-normal"> ({countdown}s)</span>}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending || countdown > 0}
                    className={`flex items-center gap-1 font-semibold transition-colors
                      ${resending || countdown > 0
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-indigo-600 hover:text-indigo-800"}`}
                  >
                    {resending
                      ? <><Loader2 size={10} className="animate-spin" /> Resending...</>
                      : <><RotateCcw size={10} /> Resend{countdown > 0 ? ` (${countdown}s)` : ""}</>
                    }
                  </button>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={otp.length < 6 || loading}
                className="w-full h-10 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-2 transition-all duration-150"
              >
                {loading ? (
                  <><Loader2 size={14} className="animate-spin" /> Verifying...</>
                ) : (
                  <><ShieldCheck size={14} /> Verify Code</>
                )}
              </Button>
            </form>

            {/* Footer */}
            <p className="text-[10px] text-slate-300 text-center">
              By continuing, you agree to our{" "}
              <Link href="/terms" className="text-slate-400 underline hover:text-slate-600 transition-colors">
                Terms of Service
              </Link>
              {" "}and{" "}
              <Link href="/privacy" className="text-slate-400 underline hover:text-slate-600 transition-colors">
                Privacy Policy
              </Link>.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
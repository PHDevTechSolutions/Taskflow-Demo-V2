"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const router  = useRouter();
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  const handleRequestReset = async () => {
    if (!email) {
      toast.error("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      const res  = await fetch("/api/request-reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      toast.success(data.message || "Reset link sent — check your inbox.");
      setSent(true);
    } catch {
      toast.error("Failed to send reset link. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] z-0 pointer-events-none" />

      <div className="relative z-10 flex items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-sm">

          {sent ? (
            /* ── Success state ── */
            <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl px-8 py-10 flex flex-col items-center gap-5 text-center
              animate-in fade-in-0 zoom-in-95 duration-300">

              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100">
                <CheckCircle2 size={32} className="text-emerald-500" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Check your inbox</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  We sent a password reset link to{" "}
                  <span className="font-semibold text-slate-700">{email}</span>.
                  The link will expire in <strong>30 minutes</strong>.
                </p>
              </div>

              <div className="w-full space-y-2 pt-1">
                <Button
                  className="w-full h-10 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                  onClick={() => router.push("/auth/login")}
                >
                  Back to Login
                </Button>
                <button
                  type="button"
                  onClick={() => { setSent(false); }}
                  className="w-full text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Didn't receive it? Try again
                </button>
              </div>
            </div>

          ) : (
            /* ── Form state ── */
            <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl px-8 py-10 space-y-6
              animate-in fade-in-0 zoom-in-95 duration-300">

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
                  <Mail size={22} className="text-indigo-500" />
                </div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Forgot password?</h1>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              {/* Email input */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@taskflow.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && email && !loading) handleRequestReset(); }}
                  className="h-10 text-sm border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-indigo-300 transition-all"
                />
              </div>

              {/* Submit */}
              <Button
                onClick={handleRequestReset}
                disabled={loading || !email}
                className="w-full h-10 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-2 transition-all duration-150"
              >
                {loading ? (
                  <><Loader2 size={14} className="animate-spin" /> Sending...</>
                ) : (
                  <><Mail size={14} /> Send Reset Link</>
                )}
              </Button>

              <p className="text-[10px] text-slate-300 text-center">
                Remember your password?{" "}
                <Link href="/auth/login" className="text-indigo-500 hover:text-indigo-700 font-medium underline transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
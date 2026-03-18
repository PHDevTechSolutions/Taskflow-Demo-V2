"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  KeyRound, Loader2, CheckCircle2, Eye, EyeOff,
  ShieldAlert, ArrowLeft,
} from "lucide-react";
import Link from "next/link";

// ─── Password strength ────────────────────────────────────────────────────────

function getStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "bg-slate-100" };
  let score = 0;
  if (pw.length >= 8)              score++;
  if (/[A-Z]/.test(pw))           score++;
  if (/[0-9]/.test(pw))           score++;
  if (/[^A-Za-z0-9]/.test(pw))   score++;
  const map: Record<number, { label: string; color: string }> = {
    1: { label: "Weak",   color: "bg-red-400"    },
    2: { label: "Fair",   color: "bg-amber-400"  },
    3: { label: "Good",   color: "bg-indigo-400" },
    4: { label: "Strong", color: "bg-emerald-500"},
  };
  return { score, ...(map[score] ?? { label: "Weak", color: "bg-red-400" }) };
}

function StrengthBar({ password }: { password: string }) {
  const { score, label, color } = getStrength(password);
  if (!password) return null;
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? color : "bg-slate-100"}`}
          />
        ))}
      </div>
      <p className={`text-[10px] font-semibold transition-colors ${score <= 1 ? "text-red-400" : score === 2 ? "text-amber-500" : score === 3 ? "text-indigo-500" : "text-emerald-600"}`}>
        {label}
      </p>
    </div>
  );
}

// ─── Password input ───────────────────────────────────────────────────────────

function PasswordInput({
  id, value, onChange, placeholder,
}: {
  id: string; value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "••••••••"}
        className="h-10 text-sm pr-10 border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-indigo-300 transition-all"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
  const router = useRouter();

  const [token,           setToken]           = useState<string | null>(null);
  const [validToken,      setValidToken]      = useState<boolean | null>(null);
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading,         setLoading]         = useState(false);
  const [done,            setDone]            = useState(false);

  const passwordsMatch = !newPassword || !confirmPassword || newPassword === confirmPassword;
  const strength       = getStrength(newPassword);
  const canSubmit      = newPassword && confirmPassword && passwordsMatch && strength.score >= 2 && !loading;

  // ── Read token from URL (client-only) ─────────────────────────────────────
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setToken(p.get("token"));
  }, []);

  // ── Verify token ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const verify = async () => {
      try {
        const res  = await fetch("/api/verify-reset-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        setValidToken(data.valid);
      } catch {
        setValidToken(false);
      }
    };
    verify();
  }, [token]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!newPassword || !confirmPassword) return toast.error("Both fields are required.");
    if (!passwordsMatch)                  return toast.error("Passwords do not match.");
    if (strength.score < 2)               return toast.error("Please use a stronger password.");

    setLoading(true);
    try {
      const res  = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Failed to reset password.");
      } else {
        setDone(true);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Loading / verifying ───────────────────────────────────────────────────
  if (!token || validToken === null) {
    return (
      <>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] z-0 pointer-events-none" />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 size={28} className="animate-spin text-indigo-500" />
            <p className="text-xs font-medium">Verifying reset link...</p>
          </div>
        </div>
      </>
    );
  }

  // ── Invalid token ─────────────────────────────────────────────────────────
  if (validToken === false) {
    return (
      <>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] z-0 pointer-events-none" />
        <div className="relative z-10 flex items-center justify-center min-h-screen px-4">
          <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-white shadow-2xl px-8 py-10 flex flex-col items-center gap-5 text-center animate-in fade-in-0 zoom-in-95 duration-300">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-50 border border-red-100">
              <ShieldAlert size={28} className="text-red-500" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-black text-slate-800">Link Invalid or Expired</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                This password reset link is no longer valid. Reset links expire after 30 minutes.
              </p>
            </div>
            <Link href="/auth/forgot-password">
              <Button size="sm" className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6">
                Request a new link
              </Button>
            </Link>
          </div>
        </div>
      </>
    );
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] z-0 pointer-events-none" />
        <div className="relative z-10 flex items-center justify-center min-h-screen px-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl px-8 py-10 flex flex-col items-center gap-5 text-center animate-in fade-in-0 zoom-in-95 duration-300">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100">
              <CheckCircle2 size={28} className="text-emerald-500" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-black text-slate-800">Password Reset!</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your password has been updated successfully. You can now sign in with your new password.
              </p>
            </div>
            <Button
              className="w-full h-10 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
              onClick={() => router.push("/auth/login")}
            >
              Go to Login
            </Button>
          </div>
        </div>
      </>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] z-0 pointer-events-none" />

      <div className="relative z-10 flex items-center justify-center min-h-screen px-4">
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
                <KeyRound size={22} className="text-indigo-500" />
              </div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Reset password</h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                Choose a strong new password for your account.
              </p>
            </div>

            {/* Fields */}
            <div className="space-y-4">

              {/* New password */}
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-xs font-semibold text-slate-700">
                  New Password
                </Label>
                <PasswordInput
                  id="new-password"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="Create a strong password"
                />
                <StrengthBar password={newPassword} />
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-xs font-semibold text-slate-700">
                  Confirm Password
                </Label>
                <PasswordInput
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                />
                {/* Match indicator */}
                {confirmPassword && (
                  <p className={`text-[11px] font-medium transition-colors ${passwordsMatch ? "text-emerald-600" : "text-red-500"}`}>
                    {passwordsMatch ? "✓ Passwords match" : "✗ Passwords do not match"}
                  </p>
                )}
              </div>

              {/* Password requirements hint */}
              <ul className="space-y-1 text-[10px] text-slate-400">
                {[
                  { rule: newPassword.length >= 8,            label: "At least 8 characters" },
                  { rule: /[A-Z]/.test(newPassword),          label: "One uppercase letter" },
                  { rule: /[0-9]/.test(newPassword),          label: "One number" },
                  { rule: /[^A-Za-z0-9]/.test(newPassword),  label: "One special character" },
                ].map(({ rule, label }) => (
                  <li key={label} className={`flex items-center gap-1.5 transition-colors ${rule ? "text-emerald-600" : "text-slate-300"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${rule ? "bg-emerald-500" : "bg-slate-200"}`} />
                    {label}
                  </li>
                ))}
              </ul>

              {/* Submit */}
              <Button
                onClick={handleReset}
                disabled={!canSubmit}
                className="w-full h-10 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-2 transition-all duration-150"
              >
                {loading ? (
                  <><Loader2 size={14} className="animate-spin" /> Resetting...</>
                ) : (
                  <><KeyRound size={14} /> Reset Password</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
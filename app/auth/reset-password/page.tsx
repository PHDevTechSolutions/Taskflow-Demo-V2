"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  FieldLabel,
  FieldGroup,
  Field,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordsMatch, setPasswordsMatch] = useState(true);

  // Live check if passwords match
  useEffect(() => {
    if (newPassword && confirmPassword) {
      setPasswordsMatch(newPassword === confirmPassword);
    } else {
      setPasswordsMatch(true);
    }
  }, [newPassword, confirmPassword]);

  const handleVerifyEmail = async () => {
    if (!email) {
      toast.error("Please enter your email.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        toast.success("Email found. Please enter your new password.");
        setEmailVerified(true);
      } else {
        const data = await res.json();
        toast.error(data.message || "Email not found.");
      }
    } catch (error) {
      toast.error("An error occurred while verifying email.");
    }
    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Please fill in both password fields.");
      return;
    }
    if (!passwordsMatch) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword }),
      });

      if (res.ok) {
        toast.success("Password reset successfully. Redirecting to login...");
        // Reset form
        setEmail("");
        setNewPassword("");
        setConfirmPassword("");
        setEmailVerified(false);

        // Redirect to login page after short delay
        setTimeout(() => {
          router.push("/login");
        }, 1500);
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to reset password.");
      }
    } catch (error) {
      toast.error("An error occurred while resetting password.");
    }
    setLoading(false);
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen bg-gray-50 px-4"
      style={{ minHeight: "100vh" }}
    >
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center">Reset Password</h1>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              placeholder="taskflow@gmail.com"
              value={email}
              disabled={emailVerified}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          {!emailVerified && (
            <Field>
              <Button
                onClick={handleVerifyEmail}
                disabled={loading || !email}
                className="w-full mt-4"
              >
                {loading ? "Verifying..." : "Verify Email"}
              </Button>
            </Field>
          )}

          {emailVerified && (
            <>
              <Field>
                <FieldLabel htmlFor="new-password">New Password</FieldLabel>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  aria-invalid={!passwordsMatch}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  aria-invalid={!passwordsMatch}
                />
              </Field>
              {!passwordsMatch && (
                <p className="text-sm text-red-600 mt-1">Passwords do not match.</p>
              )}
              <Field>
                <Button
                  onClick={handleResetPassword}
                  disabled={loading || !newPassword || !confirmPassword || !passwordsMatch}
                  className="w-full mt-4"
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>
              </Field>
            </>
          )}
        </FieldGroup>
      </div>
    </div>
  );
}

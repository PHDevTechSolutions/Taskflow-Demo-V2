"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldLabel, FieldGroup, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [validToken, setValidToken] = useState<boolean | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordsMatch, setPasswordsMatch] = useState(true);

  // Extract token on client only
  useEffect(() => {
    if (searchParams) {
      setToken(searchParams.get("token"));
    }
  }, [searchParams]);

  // Password match check
  useEffect(() => {
    setPasswordsMatch(!newPassword || !confirmPassword || newPassword === confirmPassword);
  }, [newPassword, confirmPassword]);

  // Verify token after token is set
  useEffect(() => {
    if (!token) return;

    const verifyToken = async () => {
      try {
        const res = await fetch("/api/verify-reset-token", {
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

    verifyToken();
  }, [token]);

  // Reset password
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
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Failed to reset password.");
        setLoading(false);
        return;
      }

      toast.success("Password reset successful. Redirecting to login...");
      setTimeout(() => router.push("/login"), 1500);
    } catch {
      toast.error("Something went wrong.");
    }
    setLoading(false);
  };

  // Loading state
  if (validToken === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Verifying reset link...</p>
      </div>
    );
  }

  // Invalid token
  if (validToken === false) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600 text-lg">
          This reset link is invalid or has expired.
        </p>
      </div>
    );
  }

  // Valid token UI
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center">Reset Password</h1>

        <FieldGroup>
          <Field>
            <FieldLabel>New Password</FieldLabel>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel>Confirm Password</FieldLabel>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </Field>

          {!passwordsMatch && (
            <p className="text-sm text-red-600">Passwords do not match.</p>
          )}

          <Button
            onClick={handleResetPassword}
            disabled={loading || !passwordsMatch}
            className="w-full mt-4"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </Button>
        </FieldGroup>
      </div>
    </div>
  );
}

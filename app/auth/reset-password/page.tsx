"use client"; // ⚠️ must be at top

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [token, setToken] = useState<string | null>(null);
  const [validToken, setValidToken] = useState<boolean | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordsMatch, setPasswordsMatch] = useState(true);
  const [loading, setLoading] = useState(false);

  // Extract token only on client
  useEffect(() => {
    if (searchParams) setToken(searchParams.get("token"));
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

  if (validToken === null) {
    return <p className="flex items-center justify-center min-h-screen">Verifying reset link...</p>;
  }

  if (validToken === false) {
    return <p className="text-red-600 text-lg flex items-center justify-center min-h-screen">This reset link is invalid or has expired.</p>;
  }

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) return toast.error("Both fields required");
    if (!passwordsMatch) return toast.error("Passwords do not match");
    setLoading(true);

    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data.message || "Failed");
      else {
        toast.success("Password reset successful");
        router.push("/login");
      }
    } catch {
      toast.error("Something went wrong");
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="bg-white p-8 rounded shadow w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4 text-center">Reset Password</h1>
        <FieldGroup>
          <Field>
            <FieldLabel>New Password</FieldLabel>
            <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password"/>
          </Field>
          <Field>
            <FieldLabel>Confirm Password</FieldLabel>
            <Input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password"/>
          </Field>
          {!passwordsMatch && <p className="text-red-600">Passwords do not match</p>}
          <Button onClick={handleResetPassword} disabled={loading || !passwordsMatch} className="w-full mt-4">
            {loading ? "Resetting..." : "Reset Password"}
          </Button>
        </FieldGroup>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldLabel, FieldGroup, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleRequestReset = async () => {
    if (!email) {
      toast.error("Please enter your email.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/request-reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      toast.success(data.message || "If the email exists, a reset link has been sent.");
      setSent(true);
    } catch {
      toast.error("Failed to send reset link. Try again later.");
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 gap-6">
        <Alert className="max-w-lg w-full flex items-center p-6 text-lg gap-4">
          {/* Left Text */}
          <div className="flex flex-col">
            <AlertTitle className="text-2xl font-bold">Password Reset Sent</AlertTitle>
            <AlertDescription className="mt-2 text-lg">
              Check your email! We sent you a password reset link. The link will expire in 30 minutes.
            </AlertDescription>
          </div>

          {/* Right Image */}
          <img
            src="/haro.jpg"
            alt="Haro"
            className="w-24 h-24 object-contain"
          />
        </Alert>

        <Button
          onClick={() => router.push("/login")}
          className="max-w-lg w-full py-4 text-lg font-semibold"
        >
          Go to Login
        </Button>
      </div>
    );
  }

  return (
    <>
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] z-10 pointer-events-none"
      />
      <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold mb-6 text-center">Forgot Password</h1>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="your-email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field>
              <Button
                onClick={handleRequestReset}
                disabled={loading || !email}
                className="w-full mt-4"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </Field>
          </FieldGroup>
        </div>
      </div>
    </>
  );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function PrivacyPage() {
  const lastUpdated = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-3xl rounded-2xl border border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 shrink-0">
              <ShieldCheck size={15} className="text-indigo-500" />
            </span>
            Privacy Policy
          </CardTitle>
          <p className="text-xs text-slate-500 mt-0.5 pl-10">
            Last updated: {lastUpdated}
          </p>
        </CardHeader>

        <CardContent className="space-y-3 mt-1">
          {[
            {
              label: "Data We Collect",
              body: "Taskflow collects data such as email address, device identifiers, login activity, and location details strictly for security, auditing, and system monitoring purposes.",
            },
            {
              label: "How We Use Your Data",
              body: "Your information is never sold, rented, or shared with third parties, except when required by applicable laws, regulatory requirements, or internal company policies.",
            },
            {
              label: "Your Consent",
              body: "By accessing or using Taskflow, you acknowledge and consent to the collection, processing, and use of your information in accordance with this Privacy Policy.",
            },
          ].map((section) => (
            <div
              key={section.label}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-1"
            >
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                {section.label}
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">{section.body}</p>
            </div>
          ))}

          <div className="pt-2 flex justify-end">
            <Link href="/auth/login">
              <Button
                size="sm"
                variant="outline"
                className="text-xs rounded-xl border-slate-200 text-slate-600 hover:bg-slate-100"
              >
                Back to Login
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
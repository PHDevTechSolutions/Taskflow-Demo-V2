"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PrivacyPage() {
  const lastUpdated = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-3xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">
            Privacy Policy
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            Taskflow respects your privacy and is committed to protecting your
            personal information. We collect data such as email address, device
            identifiers, login activity, and location details strictly for
            security, auditing, and system monitoring purposes.
          </p>

          <p>
            Your information is never sold, rented, or shared with third
            parties, except when required by applicable laws, regulatory
            requirements, or internal company policies.
          </p>

          <p>
            By accessing or using Taskflow, you acknowledge and consent to the
            collection, processing, and use of your information in accordance
            with this Privacy Policy.
          </p>

          <p className="text-sm text-muted-foreground pt-4">
            Last updated: {lastUpdated}
          </p>

          <div className="pt-6">
            <Link href="/auth/login">
              <Button variant="outline">
                Back to Login
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

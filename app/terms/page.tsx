"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function TermsPage() {
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-3xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">
            Terms of Service
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            Welcome to Taskflow. By accessing or using this platform, you agree
            to comply with and be legally bound by these Terms of Service.
          </p>

          <p>
            You are responsible for maintaining the confidentiality of your
            account credentials and for all activities that occur under your
            account.
          </p>

          <p>
            Any unauthorized use, abuse of the system, or attempts to bypass
            security controls may result in account suspension or permanent
            termination without prior notice.
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

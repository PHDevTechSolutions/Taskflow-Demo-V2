import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/next";
import RootClientShell from "./root";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased font-mono">
        <RootClientShell>{children}</RootClientShell>
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}

import React, { Suspense } from "react";

import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { UserProvider } from "@/contexts/UserContext";
import { Analytics } from "@vercel/analytics/next"
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Reminders } from "@/components/reminders";
import { TransferAlertDialog } from "@/components/popup-transfer";
import { ApproveDeletionDialog } from "@/components/popup-deletion";
import { ApproveTransferDialog } from "@/components/popup-approval-transferred";
import { RemoveDeletionDialog } from "@/components/popup-approval-deletion";
import { TicketEndorsed } from "@/components/popup-ticket-endorsed";
import { ActivityToday } from "@/components/popup-activity-today";
import { FollowUpToday } from "@/components/popup-follow-up-today";
import { OfflineDialog } from "@/components/offline-dialog";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap", // add this if missing, for better font loading
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});
export const metadata: Metadata = {
  title: "Taskflow - Sales Activity Planner and Tracker",
  description: "Developed by IT Team and Leroux Y Xchire",
  icons: {
    icon: "/Taskflow.png",
    shortcut: "/Taskflow.png",
    apple: "/Taskflow.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="light"
      style={{ colorScheme: "light" }}
    >
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased font-mono`}>
        <UserProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Suspense fallback={null}>
              <Reminders />
              <TransferAlertDialog />
              <ApproveDeletionDialog />
              <ApproveTransferDialog />
              <RemoveDeletionDialog />
              <TicketEndorsed />
              <ActivityToday />
              <FollowUpToday />
            </Suspense>
            <Analytics />
            {children}
            <OfflineDialog />
          </ThemeProvider>
          <Toaster />
        </UserProvider>
      </body>
    </html>
  );
}

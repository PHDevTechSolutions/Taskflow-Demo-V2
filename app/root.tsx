"use client";

import React, { Suspense } from "react";

import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { Analytics } from "@vercel/analytics/next";

// Popups
import { Reminders } from "@/components/popup/reminders";
import { TransferAlertDialog } from "@/components/popup/transfer";
import { ApproveDeletionDialog } from "@/components/popup/deletion";
import { ApproveTransferDialog } from "@/components/popup/approval-transferred";
import { RemoveDeletionDialog } from "@/components/popup/approval-deletion";
import { TicketEndorsed } from "@/components/popup/ticket-endorsed";
import { ActivityToday } from "@/components/popup/activity-today";
import { FollowUpToday } from "@/components/popup/followup-today";
import { OfflineDialog } from "@/components/popup/offline";

import { UserProvider, useUser } from "@/contexts/UserContext";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { userId } = useUser();

  return (
    <>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <Suspense fallback={null}>
          {userId && (
            <>
              <Reminders />
              <TransferAlertDialog />
              <ApproveDeletionDialog />
              <ApproveTransferDialog />
              <RemoveDeletionDialog />
              <TicketEndorsed />
              <ActivityToday />
              <FollowUpToday />
            </>
          )}
        </Suspense>
        <Analytics />
        {children}
        <OfflineDialog />
      </ThemeProvider>

      <Toaster
        position="top-right"
        toastOptions={{
          className: "toast-cyber",
          style: {
            borderRadius: "8px",
            padding: "1.5rem",
            color: "rgb(255, 255, 255)",
            fontFamily: "'Fira Code', monospace",
            fontWeight: 900,
            textTransform: "uppercase",       // <-- Gawing uppercase
            boxShadow: "0 0 8px #0ff, 0 0 16px #0ff55, 0 0 24px #0ff88",
            transition: "all 0.2s ease-in-out",
            backdropFilter: "blur(2px)",      // blur effect
            background: "rgba(0,0,0,0.6)",    // semi-transparent black
          },
          duration: 5000,
        }}
      />
      
    </>
  );
}

export default function RootLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <LayoutContent>{children}</LayoutContent>
    </UserProvider>
  );
}

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
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

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
      <Toaster />
    </>
  );
}

export default function RootLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedPageWrapper>
      <UserProvider>
        <LayoutContent>{children}</LayoutContent>
      </UserProvider>
    </ProtectedPageWrapper>
  );
}

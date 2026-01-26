"use client";

import React, { Suspense } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { UserProvider, useUser } from "@/contexts/UserContext";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

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

function PopupGate() {
  const { userId } = useUser();

  if (!userId) return null;

  return (
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
  );
}

export default function RootClientShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <UserProvider>
        <ProtectedPageWrapper>
          <PopupGate />
          {children}
          <OfflineDialog />
        </ProtectedPageWrapper>
      </UserProvider>
    </ThemeProvider>
  );
}

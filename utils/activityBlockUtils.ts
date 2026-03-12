// utils/activityBlockUtils.ts
// Per-stage block check: each stage only blocks if the same company
// already has an active activity in THAT stage's specific statuses.

export interface ActivityBlockCheck {
  blocked: boolean;
  reason: string;
  daysRemaining?: number;
}

export interface ActivityForBlock {
  id: string;
  account_reference_number: string;
  activity_reference_number: string;
  status: string;
  scheduled_date?: string;
  date_created: string;
}

export interface HistoryForBlock {
  activity_reference_number: string;
  status?: string;
}

const BLOCK_DURATION_DAYS = 30;
const DELIVERED_STATUS = "Delivered";

/**
 * Checks if a company is blocked from new activity creation FOR A SPECIFIC STAGE.
 *
 * Each stage passes its own `blockingStatuses` so the check is scoped to that stage only:
 *
 *   NewTask   → ["On-Progress", "Assisted", "Quote-Done", "SO-Done"] + checkScheduled
 *   Progress  → ["On-Progress", "Assisted", "Quote-Done", "SO-Done"]
 *   Scheduled → checkScheduled only (scheduled_date presence)
 *   Done      → ["Done"]
 *   Overdue   → checkScheduled only
 *
 * Rules:
 * 1. Find any activity for the same account_reference_number within the last 30 days
 *    whose status matches one of `blockingStatuses` (or has a non-empty scheduled_date
 *    when `checkScheduled` is true).
 * 2. Skip if that activity has a "Delivered" history entry (it's completed).
 * 3. Skip the activity identified by `excludeActivityId` (the current card's own record).
 * 4. Match found → BLOCKED.
 */
export function checkCompanyBlocked(
  accountRefNumber: string,
  activities: ActivityForBlock[],
  history: HistoryForBlock[],
  blockingStatuses: string[],
  checkScheduled = false,
  excludeActivityId?: string,
): ActivityBlockCheck {
  const now = new Date();
  const cutoffDate = new Date();
  cutoffDate.setDate(now.getDate() - BLOCK_DURATION_DAYS);

  for (const activity of activities) {
    if (activity.account_reference_number !== accountRefNumber) continue;
    if (excludeActivityId && activity.id === excludeActivityId) continue;

    const createdAt = new Date(activity.date_created);
    if (isNaN(createdAt.getTime()) || createdAt < cutoffDate) continue;

    const hasBlockingStatus = blockingStatuses.includes(activity.status);
    const isScheduled =
      checkScheduled &&
      typeof activity.scheduled_date === "string" &&
      activity.scheduled_date.trim() !== "";

    if (!hasBlockingStatus && !isScheduled) continue;

    // If already delivered in history, no longer blocking
    const isDelivered = history.some(
      (h) =>
        h.activity_reference_number === activity.activity_reference_number &&
        h.status === DELIVERED_STATUS,
    );
    if (isDelivered) continue;

    const blockExpiry = new Date(createdAt);
    blockExpiry.setDate(blockExpiry.getDate() + BLOCK_DURATION_DAYS);
    const daysRemaining = Math.ceil(
      (blockExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    const statusLabel =
      isScheduled && !hasBlockingStatus ? "Scheduled" : activity.status;

    return {
      blocked: true,
      daysRemaining: Math.max(0, daysRemaining),
      reason: `This company already has an active "${statusLabel}" activity (created ${createdAt.toLocaleDateString()}). A new activity for this stage can only be created once it is marked as Delivered, or after ${Math.max(0, daysRemaining)} day${daysRemaining !== 1 ? "s" : ""}.`,
    };
  }

  return { blocked: false, reason: "" };
}

// ─── Per-stage blocking presets ───────────────────────────────────────────────

/** NewTask "Add" — block if company is already in-progress OR scheduled */
export const BLOCK_NEW_TASK = {
  statuses: ["On-Progress", "Assisted", "Quote-Done", "SO-Done"],
  checkScheduled: true,
};

/** Progress CreateActivityDialog — block if already another in-progress entry */
export const BLOCK_PROGRESS = {
  statuses: ["On-Progress", "Assisted", "Quote-Done", "SO-Done"],
  checkScheduled: false,
};

/** Scheduled CreateActivityDialog — block if already another scheduled entry */
export const BLOCK_SCHEDULED = {
  statuses: [],
  checkScheduled: true,
};

/** Done CreateActivityDialog — block if already another Done entry */
export const BLOCK_DONE = {
  statuses: ["Done"],
  checkScheduled: false,
};

/** Overdue CreateActivityDialog — block if already another scheduled/overdue entry */
export const BLOCK_OVERDUE = {
  statuses: [],
  checkScheduled: true,
};

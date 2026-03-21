// utils/activityBlockUtils.ts

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

/* ───────────────── CONSTANTS ───────────────── */

const BLOCK_DURATION_DAYS = 30;

/** ✅ FINAL statuses (no longer blocking) */
const FINAL_STATUSES = ["delivered", "completed"];

/* ───────────────── MAIN FUNCTION ───────────────── */

/**
 * Checks if a company is blocked from new activity creation FOR A SPECIFIC STAGE.
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
    /* ── Match account ── */
    if (activity.account_reference_number !== accountRefNumber) continue;

    /* ── Skip self (editing case) ── */
    if (excludeActivityId && activity.id === excludeActivityId) continue;

    /* ── Date check ── */
    const createdAt = new Date(activity.date_created);
    if (isNaN(createdAt.getTime()) || createdAt < cutoffDate) continue;

    /* ── Status checks ── */
    const hasBlockingStatus = blockingStatuses.includes(activity.status);

    const isScheduled =
      checkScheduled &&
      typeof activity.scheduled_date === "string" &&
      activity.scheduled_date.trim() !== "";

    if (!hasBlockingStatus && !isScheduled) continue;

    /* ── ✅ FIX: Delivered OR Completed (case-insensitive) ── */
    const isFinal = history.some(
      (h) =>
        h.activity_reference_number === activity.activity_reference_number &&
        FINAL_STATUSES.includes((h.status ?? "").trim().toLowerCase())
    );

    if (isFinal) continue;

    /* ── Compute expiry ── */
    const blockExpiry = new Date(createdAt);
    blockExpiry.setDate(blockExpiry.getDate() + BLOCK_DURATION_DAYS);

    const daysRemaining = Math.ceil(
      (blockExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    const safeDays = Math.max(0, daysRemaining);

    const statusLabel =
      isScheduled && !hasBlockingStatus ? "Scheduled" : activity.status;

    return {
      blocked: true,
      daysRemaining: safeDays,
      reason: `This company already has an active "${statusLabel}" activity (created ${createdAt.toLocaleDateString()}). A new activity for this stage can only be created once it is marked as Delivered or Completed, or after ${safeDays} day${safeDays !== 1 ? "s" : ""}.`,
    };
  }

  return { blocked: false, reason: "" };
}

/* ───────────────── BLOCK PRESETS ───────────────── */

/** NewTask — block if in-progress OR scheduled */
export const BLOCK_NEW_TASK = {
  statuses: ["On-Progress", "Assisted", "Quote-Done", "SO-Done"],
  checkScheduled: true,
};

/** Progress — block if already active */
export const BLOCK_PROGRESS = {
  statuses: ["On-Progress", "Assisted", "Quote-Done", "SO-Done"],
  checkScheduled: false,
};

/** Scheduled — block if already scheduled */
export const BLOCK_SCHEDULED = {
  statuses: ["On-Progress", "Assisted"],
  checkScheduled: true,
};

/** Done — block if already Done */
export const BLOCK_COMPLETED = {
  statuses: ["Completed"],
  checkScheduled: false,
};

/** Done — block if already Done */
export const BLOCK_DONE = {
  statuses: ["Done"],
  checkScheduled: false,
};

/** Overdue — block if scheduled/overdue */
export const BLOCK_OVERDUE = {
  statuses: [],
  checkScheduled: true,
};
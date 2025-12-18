"use client";

import React from "react";

interface Props {
  activities: { call_status?: string }[];
  loading: boolean;
  error: string | null;
}

export function UnsuccessfulCallsCard({ activities, loading, error }: Props) {
  const total = activities.filter((a) => a.call_status && a.call_status !== "Successful").length;

  return (
    <div className="bg-white rounded-lg shadow p-6 flex flex-col justify-center items-center">
    </div>
  );
}

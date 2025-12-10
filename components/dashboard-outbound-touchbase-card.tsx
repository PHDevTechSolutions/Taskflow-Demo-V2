"use client";

import React from "react";

interface Props {
  activities: { source?: string }[];
  loading: boolean;
  error: string | null;
}

export function OutboundTouchbaseCard({ activities, loading, error }: Props) {
  const total = activities.filter((a) => a.source === "Outbound - Touchbase").length;

  return (
    <div className="bg-white rounded-lg shadow p-6 flex flex-col justify-center items-center">
      <h3 className="text-sm font-medium text-gray-500 mb-2">Total Outbound - Touchbase</h3>
      {loading ? (
        <div className="text-lg font-semibold text-gray-700">Loading...</div>
      ) : error ? (
        <div className="text-red-500 text-xs text-center">{error}</div>
      ) : (
        <div className="text-3xl font-bold text-gray-900">{total}</div>
      )}
    </div>
  );
}

"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export type TimeLog = {
  Type: string;
  Status: string;
  date_created: string;
  Location: string;
  PhotoURL?: string;
};

type ActivityPlannerTimeLogProps = {
  timeLogs: TimeLog[];
  loadingLogs: boolean;
  errorLogs: string | null;
};

export function TimeLogComponent({
  timeLogs,
  loadingLogs,
  errorLogs,
}: ActivityPlannerTimeLogProps) {
  return (
    <div className="mt-4 p-0 w-full">
      <h4 className="text-sm font-semibold mb-2">Time Logs</h4>

      {loadingLogs && <p className="text-[10px]">Loading logs...</p>}
      {errorLogs && <p className="text-[10px] text-red-600">{errorLogs}</p>}
      {!loadingLogs && !errorLogs && timeLogs.length === 0 && (
        <p className="text-[10px]">No logs found.</p>
      )}

      <Accordion
        type="single"
        collapsible
        className="max-h-40 overflow-auto space-y-1 w-full"
      >
        {timeLogs.map((log, i) => (
          <AccordionItem
            value={`log-${i}`}
            key={i}
            className="w-full"
          >
            <AccordionTrigger className="text-[10px] w-full">
              <strong>Type: {log.Type}</strong>
            </AccordionTrigger>
            <AccordionContent className="text-[10px] w-full">
              <div>
                <strong>Status:</strong> {log.Status}
              </div>
              <div>
                <strong>Date:</strong>{" "}
                {new Date(log.date_created).toLocaleString()}
              </div>
              <div>
                <strong>Location:</strong> {log.Location}
              </div>
              {log.PhotoURL && (
                <div className="mt-1">
                  <img
                    src={log.PhotoURL}
                    alt={`Photo for ${log.Type}`}
                    className="max-w-full h-auto rounded"
                  />
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

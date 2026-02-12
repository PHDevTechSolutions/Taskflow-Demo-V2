"use client";

import React, { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
  const [open, setOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<TimeLog | null>(null);

  const handleView = (log: TimeLog) => {
    setSelectedLog(log);
    setOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Acculog - Time Logs</CardTitle>
        </CardHeader>

        <CardContent>
          <Accordion
            type="single"
            collapsible
            className="max-h-40 overflow-auto space-y-1 w-full"
          >
            {timeLogs.map((log, i) => (
              <AccordionItem key={i} value={`log-${i}`}>
                <AccordionTrigger className="text-[10px] flex justify-between">
                  <span>
                    {log.Type} -{" "}
                    {new Date(log.date_created).toLocaleString()}
                  </span>
                </AccordionTrigger>

                <AccordionContent className="text-[10px] space-y-1">
                  <div>
                    <strong>Status:</strong> {log.Status}
                  </div>
                  <div>
                    <strong>Location:</strong> {log.Location}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 text-[10px]"
                    onClick={() => handleView(log)}
                  >
                    View
                  </Button>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* FULL SCREEN DIALOG */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[100vw] h-[70vh] rounded-none">
          <DialogHeader>
            <DialogTitle>Time Log Details</DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 text-sm overflow-auto">
              <div>
                <strong>Type:</strong> {selectedLog.Type}
              </div>

              <div>
                <strong>Status:</strong> {selectedLog.Status}
              </div>

              <div>
                <strong>Date:</strong>{" "}
                {new Date(selectedLog.date_created).toLocaleString()}
              </div>

              <div>
                <strong>Location:</strong> {selectedLog.Location}
              </div>

              {selectedLog.PhotoURL && (
                <div>
                  <strong>Photo:</strong>
                  <img
                    src={selectedLog.PhotoURL}
                    alt="Time Log Photo"
                    className="mt-2 max-w-full rounded"
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

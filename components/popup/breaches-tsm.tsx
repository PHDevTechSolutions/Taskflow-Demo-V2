"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import Lottie from "lottie-react";
// Import the JSON animation (downloaded from your Lottie link)
import buttonAnimation from "../../public/animation/breaches.json";
import TSAReports from "../popup/breaches/tsa-report";
import TSMReports from "../popup/breaches/tsm-report";

/* -------------------- Component -------------------- */
export function BreachesTSMDialog() {
    const [open, setOpen] = useState(false);

    /* -------------------- UI -------------------- */
    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent
                    className="fixed bottom-6 right-4 bg-white rounded-none shadow-xl z-50 overflow-auto border border-gray-100"
                    style={{ width: "95vw", maxWidth: "1000px", height: "75vh" }}
                >
                    <DialogHeader>
                        <DialogTitle className="uppercase tracking-tight font-bold text-[#121212]">
                            End of Day Report | TERRITORY SALES
                        </DialogTitle>
                    </DialogHeader>

                    <Tabs defaultValue="default-report" className="mt-4">
                        <TabsList className="grid grid-cols-2">
                            <TabsTrigger value="default-report" className="uppercase font-bold text-xs">
                                Default Report
                            </TabsTrigger>
                            <TabsTrigger value="agent" className="uppercase font-bold text-xs">
                                Agent
                            </TabsTrigger>
                        </TabsList>

                        {/* =================== */}
                        {/* DEFAULT REPORT TAB */}
                        {/* =================== */}
                        <TabsContent value="default-report">
                            <TSMReports />
                        </TabsContent>

                        {/* =================== */}
                        {/* AGENT TAB */}
                        {/* =================== */}
                        <TabsContent value="agent">
                            <TSAReports />
                        </TabsContent>
                    </Tabs>

                    <DialogFooter>
                        <Button variant="outline" className="rounded-none p-6" onClick={() => setOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Floating Action Button */}
            <button
                className="fixed bottom-15 right-20 z-50 w-20 h-20 rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-all duration-300 border overflow-hidden bg-white"
                onClick={() => {
                    setOpen(true);
                }}
            >
                <Lottie
                    animationData={buttonAnimation}
                    loop
                    className="w-30 h-30"
                />
            </button>
        </>
    );
}

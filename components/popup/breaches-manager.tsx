"use client";

import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import Lottie from "lottie-react";
import buttonAnimation from "../../public/animation/breaches.json";
import TSAReports from "../popup/breaches/manager/tsa-report";
import TSMReports from "../popup/breaches/manager/tsm-report";
import ManagerReports from "../popup/breaches/manager/manager-report";

export function BreachesManagerDialog() {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent
                    className="fixed bottom-6 right-4 bg-white rounded-none shadow-2xl z-50 flex flex-col border border-gray-200 p-0"
                    style={{ width: "95vw", maxWidth: "1040px", height: "80vh" }}
                >
                    {/* Header */}
                    <DialogHeader className="px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
                        <DialogTitle className="text-xs font-black uppercase tracking-widest text-gray-800 flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            End of Day Report — Territory Sales
                        </DialogTitle>
                    </DialogHeader>

                    {/* Tabs + Content */}
                    <div className="flex-1 overflow-hidden flex flex-col px-4 pt-3 pb-0">
                        <Tabs defaultValue="default-report" className="flex flex-col h-full">
                            <TabsList className="grid grid-cols-3 h-8 rounded bg-gray-100 shrink-0 mb-3">
                                <TabsTrigger
                                    value="default-report"
                                    className="rounded uppercase font-black text-[10px] tracking-wider data-[state=active]:bg-gray-900 data-[state=active]:text-white"
                                >
                                    Manager Report
                                </TabsTrigger>
                                <TabsTrigger
                                    value="tsm"
                                    className="rounded uppercase font-black text-[10px] tracking-wider data-[state=active]:bg-gray-900 data-[state=active]:text-white"
                                >
                                    TSM Report
                                </TabsTrigger>
                                <TabsTrigger
                                    value="agent"
                                    className="rounded uppercase font-black text-[10px] tracking-wider data-[state=active]:bg-gray-900 data-[state=active]:text-white"
                                >
                                    Agent Report
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent
                                value="default-report"
                                className="flex-1 overflow-y-auto mt-0 data-[state=inactive]:hidden"
                            >
                                <ManagerReports />
                            </TabsContent>

                            <TabsContent
                                value="tsm"
                                className="flex-1 overflow-y-auto mt-0 data-[state=inactive]:hidden"
                            >
                                <TSMReports />
                            </TabsContent>
                            
                            <TabsContent
                                value="agent"
                                className="flex-1 overflow-y-auto mt-0 data-[state=inactive]:hidden"
                            >
                                <TSAReports />
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Footer */}
                    <DialogFooter className="px-5 py-3 border-t border-gray-100 shrink-0">
                        <Button
                            variant="outline"
                            className="rounded-none h-8 text-xs px-5 uppercase font-bold tracking-wider"
                            onClick={() => setOpen(false)}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Floating Action Button */}
            <button
                className="fixed bottom-16 right-16 z-50 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all duration-200 border border-gray-200 overflow-hidden bg-white"
                onClick={() => setOpen(true)}
                title="Open End of Day Report"
            >
                <Lottie
                    animationData={buttonAnimation}
                    loop
                    className="w-24 h-24"
                />
            </button>
        </>
    );
}
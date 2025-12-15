"use client";

import React, { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

export function OfflineDialog() {
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        function handleOnline() {
            console.log("Online detected");
            setIsOffline(false);
        }
        function handleOffline() {
            console.log("Offline detected");
            setIsOffline(true);
        }

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        // Check initial status on mount
        const initial = !navigator.onLine;
        console.log("Initial offline:", initial);
        setIsOffline(initial);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);


    return (
        <Dialog open={isOffline} onOpenChange={() => { /* prevent closing */ }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>No Internet Connection</DialogTitle>
                    <DialogDescription>
                        Please check your network connection and try again.
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    );
}

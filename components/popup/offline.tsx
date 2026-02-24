"use client";

import React, { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import Lottie from "lottie-react";

// Import JSON animation from public folder
import noInternetAnimation from "../../public/animation/No internet.json";

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
            <DialogContent className="rounded-none flex flex-col items-center justify-center gap-4 p-6">
                <Lottie
                    animationData={noInternetAnimation}
                    loop
                    className="w-60 h-60"
                />
                <DialogHeader className="text-center">
                    <DialogTitle>No Internet Connection</DialogTitle>
                    <DialogDescription>
                        Please check your network connection and try again.
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    );
}
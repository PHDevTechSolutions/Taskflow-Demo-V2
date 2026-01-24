"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
    return (

        <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
            <div
                className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] 
                 bg-[size:24px_24px] z-10 pointer-events-none"
            />
            <h1 className="text-6xl font-bold">404</h1>

            <p className="text-muted-foreground text-lg">
                Oops! Page not found.
            </p>

            <Link href="/">
                <Button>
                    Back to Home
                </Button>
            </Link>
        </div>
    );
}

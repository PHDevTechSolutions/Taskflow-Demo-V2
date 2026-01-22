"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@/contexts/UserContext";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { userId } = useUser();
  const router = useRouter();
  const pathname = usePathname() || "";

  useEffect(() => {
    // allow login page
    if (pathname.startsWith("/auth/login")) return;

    // ❌ not logged in → redirect
    if (!userId) {
      router.replace("/auth/login");
    }
  }, [userId, pathname, router]);

  // block protected pages while redirecting
  if (!userId && !pathname.startsWith("/auth/login")) {
    return null;
  }

  return <>{children}</>;
}

"use client";

import React, { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "../../contexts/UserContext";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { userId } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!userId) {
      // Wala pang userId, i-redirect sa login
      router.push("/auth/login");
    }
  }, [userId, router]);

  // Habang kino-confirm, pwede mag-show ng loading spinner or nothing
  if (!userId) {
    return <div>Loading...</div>;
  }

  return <>{children}</>;
}

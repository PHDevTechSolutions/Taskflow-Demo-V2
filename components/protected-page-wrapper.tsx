"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProtectedPageWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const deviceId = localStorage.getItem("deviceId") || "";

        const res = await fetch("/api/check-session", {
          headers: { "x-device-id": deviceId },
          cache: "no-store", // make sure it doesn't cache
        });

        if (res.status !== 200) {
          router.replace("/auth/login");
          return;
        }

        setLoading(false);
      } catch (error) {
        console.error("Session check failed:", error);
        router.replace("/auth/login");
      }
    };

    checkSession();
  }, [router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-sm text-gray-600">
        Checking authentication...
      </div>
    );
  }

  return <>{children}</>;
}

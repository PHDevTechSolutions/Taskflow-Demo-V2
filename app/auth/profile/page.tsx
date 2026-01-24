import React, { Suspense } from "react";
import dynamic from "next/dynamic";
import ProfileClient from "@/components/general/edit";

const ProtectedPageWrapper = dynamic(() => import("@/components/protected-page-wrapper"), {
  ssr: false,
});

export default function ProfilePage() {
  return (
    <ProtectedPageWrapper>
      <Suspense fallback={<div>Loading profile...</div>}>
        <ProfileClient />
      </Suspense>
    </ProtectedPageWrapper>
  );
}

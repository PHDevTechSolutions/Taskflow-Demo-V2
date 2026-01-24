import React, { Suspense } from "react";
import ProfileClient from "@/components/general/edit";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

export default function ProfilePage() {
  return (
    <ProtectedPageWrapper>
      <Suspense fallback={<div>Loading profile...</div>}>
        <ProfileClient />
      </Suspense>
    </ProtectedPageWrapper>
  );
}

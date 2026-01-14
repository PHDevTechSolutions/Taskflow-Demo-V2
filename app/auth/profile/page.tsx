import React, { Suspense } from "react";
import ProfileClient from "@/components/profile-update";

export default function ProfilePage() {
  return (
    <Suspense fallback={<div>Loading profile...</div>}>
      <ProfileClient />
    </Suspense>
  );
}

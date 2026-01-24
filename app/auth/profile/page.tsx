"use client";

import React, { Suspense } from "react";
import ProfileClient from "@/components/general/edit";


export default function ProfilePage() {
  return (
    <Suspense fallback={<div>Loading profile...</div>}>
      <ProfileClient />
    </Suspense>
  );
}

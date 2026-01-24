"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation"; // Next.js 13 app router
import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  LogOut,
} from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

export function NavUser({
  user,
  userId,
}: {
  user: {
    name: string;
    position?: string;
    email: string;
    ReferenceID: string;
    TSM: string;
    Manager: string;
    avatar: string;
  };
  userId: string;
}) {
  const { isMobile } = useSidebar();
  const router = useRouter();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const logLogoutActivity = async () => {
    try {
      const deviceId = localStorage.getItem("deviceId") || "unknown-device";
      const location = null; // add geo-location if needed
      await addDoc(collection(db, "activity_logs"), {
        userId,
        email: user.email,
        status: "logout",
        timestamp: new Date().toISOString(),
        deviceId,
        location,
        ReferenceID: user.ReferenceID,
        TSM: user.TSM,
        Manager: user.Manager,
        browser: navigator.userAgent,
        os: navigator.platform,
        date_created: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to log logout activity:", error);
    }
  };

  const doLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logLogoutActivity();
      localStorage.removeItem("userId");
      router.replace("/auth/login");
    } finally {
      setIsLoggingOut(false);
      setIsDialogOpen(false);
    }
  };

  return (
    <>
      <ProtectedPageWrapper>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-lg">TF</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    {user.position && (
                      <span className="truncate text-xs text-muted-foreground">
                        {user.position}
                      </span>
                    )}
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                className="min-w-[224px] rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align="start"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{user.name}</span>
                      {user.position && (
                        <span className="truncate text-xs text-muted-foreground">
                          {user.position}
                        </span>
                      )}
                    </div>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link href={`/auth/profile?id=${encodeURIComponent(userId)}`}>
                      <div className="flex items-center gap-2">
                        <BadgeCheck />
                        <span>Account</span>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => setIsDialogOpen(true)}
                  className="cursor-pointer"
                  disabled={isLoggingOut}
                >
                  <LogOut />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Dialog confirmation */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Logout</DialogTitle>
              <DialogDescription>
                Are you sure you want to log out?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isLoggingOut}
              >
                Cancel
              </Button>
              <Button
                onClick={doLogout}
                disabled={isLoggingOut}
                className="ml-2"
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ProtectedPageWrapper>
    </>
  );
}

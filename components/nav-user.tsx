"use client";

import React from "react";
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

import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export function NavUser({
  user,
  userId,
}: {
  user: {
    name: string;
    position?: string;
    avatar: string;
  };
  userId: string; // accept userId as prop
}) {
  const { isMobile } = useSidebar();
  const router = useRouter();

  const logLogoutActivity = async () => {
    try {
      // Gather details similar to login activity
      const deviceId = localStorage.getItem("deviceId") || "unknown-device";
      const location = null; // Optionally, you can implement geo-location like login
      await addDoc(collection(db, "activity_logs"), {
        userId,
        email: user.name, // or you can pass email as a prop if available
        status: "logout",
        timestamp: new Date().toISOString(),
        deviceId,
        location,
        browser: navigator.userAgent,
        os: navigator.platform,
        date_created: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to log logout activity:", error);
    }
  };

  const handleLogout = async () => {
    await logLogoutActivity();

    localStorage.removeItem("userId");
    router.replace("/login");
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
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
                <Link href={`/profile?id=${encodeURIComponent(userId)}`}>
                  <div className="flex items-center gap-2">
                    <BadgeCheck />
                    <span>Account</span>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

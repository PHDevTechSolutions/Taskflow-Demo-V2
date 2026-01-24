"use client"

import * as React from "react"
import Image from "next/image"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

export function TeamSwitcher({
  teams,
}: {
  teams: {
    name: string
    plan: string
  }[]
}) {
  const [activeTeam] = React.useState(teams[0])

  if (!activeTeam) {
    return null
  }

  return (
    <ProtectedPageWrapper>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton className="w-full">
            <div className="flex items-center space-x-3">
              <Image
                src="/Taskflow.png"
                alt="Taskflow Logo"
                width={28}
                height={28}
                className="rounded-full"
              />
              <span className="truncate font-medium">{activeTeam.name}</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </ProtectedPageWrapper>
  )
}

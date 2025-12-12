"use client";

import { ChevronRight } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

export function NavWorkspaces({
  workspaces,
  openSections,
  onToggleSection,
}: {
  workspaces: {
    name: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    url?: string;
    pages: {
      name: string;
      icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
      url: string;
    }[];
  }[];
  openSections: Record<string, boolean>;
  onToggleSection: (section: string) => void;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Workspaces</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {workspaces.map((workspace) => {
            const WorkspaceIcon = workspace.icon;
            return (
              <Collapsible
                key={workspace.name}
                open={!!openSections[workspace.name]}
                onOpenChange={() => onToggleSection(workspace.name)}
              >
                <SidebarMenuItem className="flex items-center justify-between">
                  {/* This button toggles collapse */}
                  <SidebarMenuButton
                    onClick={() => onToggleSection(workspace.name)}
                    className="flex items-center space-x-2 cursor-pointer flex-grow"
                  >
                    <WorkspaceIcon className="w-5 h-5" />
                    <span>{workspace.name}</span>
                  </SidebarMenuButton>

                  {/* Optional navigation link as separate button */}
                  {workspace.url && (
                    <a
                      href={workspace.url}
                      onClick={(e) => e.stopPropagation()} // Prevent toggle when clicking this link
                      className="text-sm text-blue-500 hover:underline ml-2"
                    >
                      Go
                    </a>
                  )}

                  {/* Arrow icon for collapse state */}
                  <CollapsibleTrigger asChild>
                    <SidebarMenuAction
                      className="bg-sidebar-accent text-sidebar-accent-foreground left-2 data-[state=open]:rotate-90"
                      showOnHover
                    >
                      <ChevronRight />
                    </SidebarMenuAction>
                  </CollapsibleTrigger>
                </SidebarMenuItem>

                <CollapsibleContent>
                  <SidebarMenuSub>
                    {workspace.pages.map((page) => {
                      const PageIcon = page.icon;
                      return (
                        <SidebarMenuSubItem key={page.name}>
                          <SidebarMenuSubButton asChild>
                            <a href={page.url} className="flex items-center space-x-2">
                              <PageIcon className="w-4 h-4" />
                              <span>{page.name}</span>
                            </a>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

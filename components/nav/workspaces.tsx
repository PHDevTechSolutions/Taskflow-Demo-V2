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
      badge?: string | number; // 1. Added badge to the type definition
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
                  <SidebarMenuButton
                    onClick={() => onToggleSection(workspace.name)}
                    className="flex items-center space-x-2 cursor-pointer flex-grow break-words"
                  >
                    <WorkspaceIcon className="w-5 h-5 flex-shrink-0" />
                    <span className="whitespace-normal break-words leading-snug">{workspace.name}</span>
                  </SidebarMenuButton>

                  {workspace.url && (
                    <a
                      href={workspace.url}
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm text-blue-500 hover:underline ml-2"
                    >
                      Go
                    </a>
                  )}

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
                        <SidebarMenuSubItem key={`${workspace.name}-${page.name}-${page.url}`}>
                          <SidebarMenuSubButton asChild className="h-auto py-1.5">
                            <a href={page.url} className="flex items-center justify-between w-full">
                              <div className="flex items-start gap-2 min-w-0 flex-1">
                                <PageIcon className="w-4 h-4 flex-shrink-0" />
                                <span className="whitespace-normal break-words leading-snug text-[13px]">{page.name}</span>
                              </div>
                              {page.badge && (
                                <span className="ml-1 flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm">
                                  {page.badge}
                                </span>
                              )}
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
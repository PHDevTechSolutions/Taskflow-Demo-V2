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
                <SidebarMenuItem className="flex flex-col w-full">
                  {/* Workspace button */}
                  <div className="flex items-center justify-between w-full">
                    <SidebarMenuButton
                      onClick={() => onToggleSection(workspace.name)}
                      className="flex items-center space-x-2 cursor-pointer flex-grow min-w-0"
                    >
                      <WorkspaceIcon className="w-5 h-5 flex-shrink-0" />
                      <span className="break-words">{workspace.name}</span>
                    </SidebarMenuButton>

                    {/* Collapse arrow */}
                    <CollapsibleTrigger asChild>
                      <SidebarMenuAction
                        className="bg-sidebar-accent text-sidebar-accent-foreground left-2 data-[state=open]:rotate-90"
                        showOnHover
                      >
                        <ChevronRight />
                      </SidebarMenuAction>
                    </CollapsibleTrigger>
                  </div>

                  {/* Pages / sub-items */}
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {workspace.pages.map((page) => {
                        const PageIcon = page.icon;
                        return (
                          <SidebarMenuSubItem key={`${workspace.name}-${page.name}-${page.url}`}>
                            <SidebarMenuSubButton asChild>
                              <a href={page.url} className="flex items-center space-x-2">
                                <PageIcon className="w-4 h-4 flex-shrink-0" />
                                <span className="break-words">{page.name}</span>
                              </a>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

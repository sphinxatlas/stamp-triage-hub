import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Camera, Boxes, Stamp, Files, Download } from "lucide-react";

import { IdentifyRunIndicator } from "@/components/identify-run";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Capture", url: "/capture", icon: Camera },
  { title: "Pages", url: "/pages", icon: Files },
  { title: "Containers", url: "/containers", icon: Boxes },
  { title: "Stamps", url: "/stamps", icon: Stamp },
  { title: "Export", url: "/export", icon: Download },
] as const;


export function AppSidebar() {
  const currentPath = useRouterState({ select: (router) => router.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Stamp triage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={currentPath === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupContent className="px-2">
            <IdentifyRunIndicator />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

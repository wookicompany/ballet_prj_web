"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { getAdminToken } from "@/lib/adminUtils";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  CalendarDays,
  Inbox,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  Users,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "개요",
    items: [{ href: "/wookicompany/admin", label: "대시보드", icon: LayoutDashboard }],
  },
  {
    label: "운영 관리",
    items: [
      { href: "/wookicompany/admin/records", label: "캘린더 기록 관리", icon: CalendarDays },
      { href: "/wookicompany/admin/reviews", label: "공연 리뷰/댓글 관리", icon: MessageSquare },
      { href: "/wookicompany/admin/notices", label: "공지사항 관리", icon: Bell },
      { href: "/wookicompany/admin/support-inquiries", label: "문의 관리", icon: Inbox },
      { href: "/wookicompany/admin/ads", label: "광고 관리", icon: Megaphone },
    ],
  },
  {
    label: "회원",
    items: [{ href: "/wookicompany/admin/members", label: "회원 관리", icon: Users }],
  },
] as const;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading, signOut } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const checkAdmin = useCallback(async () => {
    const token = await getAdminToken();
    if (!token) {
      setAdminChecked(true);
      setIsAdmin(false);
      return;
    }
    const res = await fetch("/api/admin/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
    setAdminChecked(true);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setAdminChecked(true);
      setIsAdmin(false);
      return;
    }
    checkAdmin();
  }, [user, authLoading, checkAdmin]);

  useEffect(() => {
    if (!adminChecked || isAdmin) return;
    if (!user) {
      openLoginSheet();
      return;
    }
    router.replace("/calendar");
  }, [adminChecked, isAdmin, user, openLoginSheet, router]);

  const handleLogout = useCallback(async () => {
    await signOut();
    router.replace("/calendar");
  }, [signOut, router]);

  if (!adminChecked || !isAdmin) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="flex flex-col gap-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-10 w-32 mt-2" />
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center gap-2 px-2 py-2">
            <span className="font-semibold text-sidebar-foreground">ADMIN</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {NAV_GROUPS.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent className="gap-2">
                <SidebarMenu className="gap-2">
                  {group.items.map(({ href, label, icon: Icon }) => {
                    const isActive =
                      pathname === href ||
                      (href !== "/wookicompany/admin" && pathname.startsWith(href));
                    return (
                      <SidebarMenuItem
                        key={href}
                        className={
                          isActive
                            ? "rounded-md bg-zinc-800 [&_a]:!bg-transparent [&_a]:!text-white [&_a:hover]:!bg-zinc-700 [&_a:hover]:!text-white"
                            : undefined
                        }
                      >
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className="min-h-11 w-full py-3 data-[active=true]:!bg-transparent data-[active=true]:!text-white data-[active=true]:font-semibold"
                        >
                          <Link href={href}>
                            <Icon className="size-4" />
                            <span>{label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex min-h-14 shrink-0 items-center justify-end gap-3 border-b border-border bg-background px-4 py-2 md:px-6">
          <div className="flex shrink-0 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="size-9 p-0"
              aria-label="로그아웃"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

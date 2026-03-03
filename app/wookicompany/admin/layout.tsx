"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
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
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard,
  CalendarDays,
  MessageSquare,
  Megaphone,
  Users,
  LogOut,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

const NAV_ITEMS = [
  { href: "/wookicompany/admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/wookicompany/admin/records", label: "캘린더 기록 관리", icon: CalendarDays },
  { href: "/wookicompany/admin/reviews", label: "공연 리뷰/댓글 관리", icon: MessageSquare },
  { href: "/wookicompany/admin/notices", label: "공지사항 관리", icon: Megaphone },
  { href: "/wookicompany/admin/members", label: "회원 관리", icon: Users },
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
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session?.access_token) {
      setAdminChecked(true);
      setIsAdmin(false);
      return;
    }
    const res = await fetch("/api/admin/me", {
      headers: { Authorization: `Bearer ${session.access_token}` },
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
            <span className="font-semibold text-sidebar-foreground">어드민</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>메뉴</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={pathname === href || (href !== "/wookicompany/admin" && pathname.startsWith(href))}>
                      <Link href={href}>
                        <Icon className="size-4" />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm font-medium text-muted-foreground">관리자</span>
          <div className="ml-auto">
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5">
              <LogOut className="size-4" />
              로그아웃
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

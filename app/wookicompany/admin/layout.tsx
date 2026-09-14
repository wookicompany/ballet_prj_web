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
import { Bell, CalendarDays, Inbox, LayoutDashboard, LogOut, Megaphone, MessageSquare, Tag, Ticket, Users } from "lucide-react";

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
      { href: "/wookicompany/admin/tickets", label: "티켓북 관리", icon: Ticket },
      { href: "/wookicompany/admin/brands", label: "브랜드 관리", icon: Tag },
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
  // "확인 중 / 통과 / 권한 없음 / 확인 실패"를 구분한다. 예전에는 통과 여부만 boolean으로
  // 두어, Supabase Auth가 잠깐 흔들려 401이나 5xx가 오면 권한 없음과 똑같이 취급해
  // 어드민을 캘린더로 쫓아냈다(2026-09-14 실제 발생).
  const [gate, setGate] = useState<"checking" | "allowed" | "denied" | "error">(
    "checking"
  );
  const [retrying, setRetrying] = useState(false);

  // 이 함수 안에서 동기적으로 setState하지 않는다 — effect가 호출하는 함수가 곧바로
  // setState하면 린트(react-hooks/set-state-in-effect)에 걸린다. 첫 동작은 항상 await다.
  const checkAdmin = useCallback(async () => {
    const token = await getAdminToken();
    if (!token) {
      setGate("denied");
      return;
    }
    try {
      const res = await fetch("/api/admin/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setGate("allowed");
        return;
      }
      // 403만이 확실한 "권한 없음"이다. 401과 5xx는 인증 서버가 흔들린 것일 수 있어
      // 권한 없음으로 단정하지 않는다(서버는 프로필 조회 실패를 503으로 따로 내려준다).
      setGate(res.status === 403 ? "denied" : "error");
    } catch {
      setGate("error");
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    // checkAdmin의 setState는 전부 await 뒤에서 일어나므로 cascading render가 나지 않는다.
    // 린트는 async 함수 안까지 추적하되 await 경계를 구분하지 못해 이 호출을 잡는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkAdmin();
  }, [user, authLoading, checkAdmin]);

  // 로그인하지 않은 상태는 상태값이 아니라 파생이다.
  const resolvedGate = authLoading ? "checking" : user ? gate : "denied";

  useEffect(() => {
    // 확인 실패(error)는 리다이렉트하지 않는다 — 화면에 남겨 재시도할 수 있게 한다.
    if (resolvedGate !== "denied") return;
    if (!user) {
      openLoginSheet();
      return;
    }
    router.replace("/calendar");
  }, [resolvedGate, user, openLoginSheet, router]);

  const handleLogout = useCallback(async () => {
    await signOut();
    router.replace("/calendar");
  }, [signOut, router]);

  // 확인에 실패한 경우는 쫓아내지 않고 상황을 알리고 다시 시도할 수 있게 한다.
  if (resolvedGate === "error") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-6">
        <div className="flex max-w-sm flex-col gap-3 text-center">
          <h1 className="text-lg font-semibold">잠시 연결이 불안정해요</h1>
          <p className="text-sm text-muted-foreground">
            권한을 확인하지 못했어요. 로그인 상태에는 문제가 없으니 잠시 후 다시
            시도해 주세요.
          </p>
          <div className="mt-2 flex justify-center gap-2">
            <Button
              onClick={async () => {
                setRetrying(true);
                setGate("checking");
                await checkAdmin();
                setRetrying(false);
              }}
              disabled={retrying}
            >
              {retrying ? "확인하는 중" : "다시 시도"}
            </Button>
            <Button variant="outline" onClick={() => router.replace("/calendar")}>
              캘린더로
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (resolvedGate !== "allowed") {
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

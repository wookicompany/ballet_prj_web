"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getAccessToken } from "@/lib/authSession";
import {
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Database,
  MessageCircle,
  ShieldCheck,
  User,
} from "lucide-react";

export default function ProfileMenuPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [hasUnreadNotices, setHasUnreadNotices] = useState(false);

  useEffect(() => {
    const fetchNoticeReadStatus = async () => {
      if (loading) return;
      if (!user) {
        setHasUnreadNotices(false);
        return;
      }

      const accessToken = await getAccessToken(openLoginSheet);
      if (!accessToken) {
        setHasUnreadNotices(false);
        return;
      }

      const response = await fetch("/api/notices/read-status", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) {
        setHasUnreadNotices(false);
        return;
      }

      const payload = (await response.json()) as { has_unread?: boolean };
      setHasUnreadNotices(payload.has_unread === true);
    };

    void fetchNoticeReadStatus();
  }, [user, loading, openLoginSheet]);

  if (loading) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen items-center justify-center">
          <Spinner size="lg" />
        </main>
      </MobileContainer>
    );
  }

  return (
    <MobileContainer>
      <main className="px-4 pb-12 pt-2">
        <header className="mb-6 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="text-[#17171c]/70"
            onClick={() => router.back()}
            aria-label="뒤로"
          >
            <ChevronLeft className="size-6" />
          </Button>
          <h1 className="text-base font-semibold">더보기</h1>
          <div className="w-9" />
        </header>

        <section className="divide-y divide-black/5 rounded-xl border border-black/5 bg-white">
          <Button
            type="button"
            variant="ghost"
            className="h-14 w-full justify-between px-4"
            onClick={() => router.push("/calendar/settings")}
          >
            <span className="flex items-center gap-3 text-sm text-[#17171c]">
              <Calendar className="h-5 w-5 text-[#17171c]/70" />
              캘린더 설정
            </span>
            <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-14 w-full justify-between px-4"
            onClick={() => router.push("/profile/data-management")}
          >
            <span className="flex items-center gap-3 text-sm text-[#17171c]">
              <Database className="h-5 w-5 text-[#17171c]/70" />
              데이터 관리
            </span>
            <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-14 w-full justify-between px-4"
            onClick={() => router.push("/profile/account")}
          >
            <span className="flex items-center gap-3 text-sm text-[#17171c]">
              <User className="h-5 w-5 text-[#17171c]/70" />
              계정 관리
            </span>
            <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-14 w-full justify-between px-4"
            onClick={() => router.push("/notice")}
          >
            <span className="flex items-center gap-3 text-sm text-[#17171c]">
              <Bell className="h-5 w-5 text-[#17171c]/70" />
              <span className="inline-flex items-center gap-2">
                공지사항
                {hasUnreadNotices ? (
                  <span className="h-2 w-2 rounded-full bg-[#FF154A]" />
                ) : null}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-14 w-full justify-between px-4"
            onClick={() => router.push("/policy")}
          >
            <span className="flex items-center gap-3 text-sm text-[#17171c]">
              <ShieldCheck className="h-5 w-5 text-[#17171c]/70" />
              서비스 이용정책
            </span>
            <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-14 w-full justify-between px-4"
            onClick={() => router.push("/support")}
          >
            <span className="flex items-center gap-3 text-sm text-[#17171c]">
              <MessageCircle className="h-5 w-5 text-[#17171c]/70" />
              문의하기
            </span>
            <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
          </Button>
        </section>
      </main>
    </MobileContainer>
  );
}

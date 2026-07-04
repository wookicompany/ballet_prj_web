"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getAccessToken } from "@/lib/authSession";
import {
  getNoticeReadStatusCache,
  setNoticeReadStatusCache,
} from "@/lib/noticeReadStatusCache";
import {
  Bell,
  Calendar,
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
    const controller = new AbortController();

    const fetchNoticeReadStatus = async () => {
      if (loading) return;
      if (!user) {
        setHasUnreadNotices(false);
        return;
      }

      // 세션 내 캐시가 있으면 즉시 표시하고, 아래 fetch로 백그라운드 재검증
      const cachedStatus = getNoticeReadStatusCache(user.id);
      if (cachedStatus) {
        setHasUnreadNotices(cachedStatus.unreadNoticeIds.length > 0);
      }

      const accessToken = await getAccessToken(openLoginSheet);
      if (!accessToken) {
        setHasUnreadNotices(false);
        return;
      }

      try {
        const response = await fetch("/api/notices/read-status", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          setHasUnreadNotices(false);
          return;
        }

        const payload = (await response.json()) as {
          has_unread?: boolean;
          read_notice_ids?: string[];
          unread_notice_ids?: string[];
        };
        setHasUnreadNotices(payload.has_unread === true);
        setNoticeReadStatusCache({
          userId: user.id,
          readNoticeIds: Array.isArray(payload.read_notice_ids) ? payload.read_notice_ids : [],
          unreadNoticeIds: Array.isArray(payload.unread_notice_ids) ? payload.unread_notice_ids : [],
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setHasUnreadNotices(false);
      }
    };

    void fetchNoticeReadStatus();

    return () => controller.abort();
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
      <main className="px-4 pb-12">
        <PageHeader title="설정" className="mb-6" />

        <section className="divide-y divide-[#17171c]/5 rounded-xl border border-[#17171c]/5 bg-white">
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

"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { useConsentSheet } from "@/components/auth/ConsentSheetProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  ChevronRight,
  Heart,
  ListOrdered,
  MapPin,
  Repeat,
  UserRound,
} from "lucide-react";

export default function DataManagementPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const { ensureConsent } = useConsentSheet();

  // 캘린더 +가 그랬듯 생성 진입점은 필수 약관 동의를 먼저 확인한다.
  const handleAddRecurring = useCallback(async () => {
    const consentOk = await ensureConsent();
    if (!consentOk) return;
    router.push("/record/recurring/new");
  }, [ensureConsent, router]);

  if (loading) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen items-center justify-center">
          <Spinner size="lg" />
        </main>
      </MobileContainer>
    );
  }

  if (!user) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-[#17171c]/70">
            로그인이 필요한 화면이에요.
          </p>
          <Button
            type="button"
            className="bg-[#17171c] text-white"
            onClick={openLoginSheet}
          >
            로그인하고 계속하기
          </Button>
        </main>
      </MobileContainer>
    );
  }

  return (
    <MobileContainer>
      <main className="px-4 pb-16">
        <PageHeader title="데이터 관리" className="mb-6" />

        <div className="space-y-6">
          <div className="space-y-2">
            <p className="px-1 text-xs font-medium text-[#17171c]/40">캘린더</p>
            <section className="divide-y divide-[#17171c]/5 rounded-xl border border-[#17171c]/5 bg-white">
              {/* 캘린더 +의 선택지 시트에서 옮겨온 진입점. 목록 조회 API(GET)가 아직
                  없어 "관리"가 아니라 "추가"로 둔다 — 목록 화면이 생기면 승격한다. */}
              <Button
                type="button"
                variant="ghost"
                className="h-14 w-full justify-between px-4"
                onClick={handleAddRecurring}
              >
                <span className="flex items-center gap-3 text-sm text-[#17171c]">
                  <Repeat className="h-5 w-5 text-[#17171c]/70" />
                  반복 수업 추가
                </span>
                <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-14 w-full justify-between px-4"
                onClick={() => router.push("/calendar/settings/locations")}
              >
                <span className="flex items-center gap-3 text-sm text-[#17171c]">
                  <MapPin className="h-5 w-5 text-[#17171c]/70" />
                  장소 관리
                </span>
                <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-14 w-full justify-between px-4"
                onClick={() => router.push("/calendar/settings/instructor-levels")}
              >
                <span className="flex items-center gap-3 text-sm text-[#17171c]">
                  <UserRound className="h-5 w-5 text-[#17171c]/70" />
                  선생님 & 레벨 관리
                </span>
                <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-14 w-full justify-between px-4"
                onClick={() => router.push("/calendar/settings/bar-orders")}
              >
                <span className="flex items-center gap-3 text-sm text-[#17171c]">
                  <ListOrdered className="h-5 w-5 text-[#17171c]/70" />
                  바 순서 관리
                </span>
                <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-14 w-full justify-between px-4"
                onClick={() => router.push("/calendar/settings/center-orders")}
              >
                <span className="flex items-center gap-3 text-sm text-[#17171c]">
                  <ListOrdered className="h-5 w-5 text-[#17171c]/70" />
                  센터 순서 관리
                </span>
                <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
              </Button>
            </section>
          </div>

          <div className="space-y-2">
            <p className="px-1 text-xs font-medium text-[#17171c]/40">공연</p>
            <section className="divide-y divide-[#17171c]/5 rounded-xl border border-[#17171c]/5 bg-white">
              <Button
                type="button"
                variant="ghost"
                className="h-14 w-full justify-between px-4"
                onClick={() => router.push("/profile/data-management/dancers")}
              >
                <span className="flex items-center gap-3 text-sm text-[#17171c]">
                  <Heart className="h-5 w-5 text-[#17171c]/70" />
                  무용수 관리
                </span>
                <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
              </Button>
            </section>
          </div>
        </div>
      </main>
    </MobileContainer>
  );
}

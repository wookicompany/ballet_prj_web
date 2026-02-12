"use client";

import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Circle,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  MapPin,
  UserRound,
} from "lucide-react";

export default function DataManagementPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();

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
            className="bg-[#17171c] text-white hover:bg-[#17171c]/90"
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
      <main className="px-4 pb-16 pt-6">
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
          <h1 className="text-base font-semibold">데이터 관리</h1>
          <div className="w-9" />
        </header>

        <section className="divide-y divide-black/5 rounded-xl border border-black/5 bg-white">
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
              강사님 & 레벨 관리
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
              <GripVertical className="h-5 w-5 text-[#17171c]/70" />
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
              <Circle className="h-5 w-5 text-[#17171c]/70" />
              센터 순서 관리
            </span>
            <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
          </Button>
        </section>
      </main>
    </MobileContainer>
  );
}

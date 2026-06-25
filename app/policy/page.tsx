"use client";

import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

export default function PolicyPage() {
  const router = useRouter();

  return (
    <MobileContainer>
      <main className="px-4 pb-12">
        <PageHeader title="서비스 이용정책" className="mb-6" />

        <section className="divide-y divide-[#17171c]/5 rounded-xl border border-[#17171c]/5 bg-white">
          <Button
            type="button"
            variant="ghost"
            className="h-14 w-full justify-between px-4"
            onClick={() => router.push("/policy/terms")}
          >
            <span className="text-sm text-[#17171c]">서비스 이용약관</span>
            <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-14 w-full justify-between px-4"
            onClick={() => router.push("/policy/privacy")}
          >
            <span className="text-sm text-[#17171c]">개인정보 처리방침</span>
            <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-14 w-full justify-between px-4"
            onClick={() => router.push("/policy/community-rules")}
          >
            <span className="text-sm text-[#17171c]">공연 커뮤니티 이용규칙</span>
            <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
          </Button>
        </section>
      </main>
    </MobileContainer>
  );
}

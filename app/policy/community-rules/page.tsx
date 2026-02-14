"use client";

import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

const COMMUNITY_RULES = [
  {
    title: "1. 목적",
    content:
      "공연 커뮤니티 이용규칙은 이용자가 안전하고 즐겁게 리뷰와 댓글을 작성할 수 있도록 기준을 안내하기 위해 마련했어요.",
  },
  {
    title: "2. 적용 범위",
    content:
      "이 규칙은 공연 상세와 리뷰 상세에서 작성·노출되는 리뷰, 댓글, 이미지, 신고 기능 이용에 적용돼요.",
  },
  {
    title: "3. 금지되는 행위",
    content:
      "욕설·혐오·괴롭힘, 음란하거나 성적으로 불쾌감을 주는 표현, 사실과 다른 허위 정보, 광고·도배성 게시물, 타인의 개인정보 노출, 저작권 침해 콘텐츠 게시는 금지돼요.",
  },
  {
    title: "4. 신고 및 노출 제한",
    content:
      "이용자는 규칙 위반 콘텐츠를 신고할 수 있어요. 신고가 누적된 리뷰 또는 댓글은 운영 정책에 따라 임시로 숨김 처리될 수 있어요.",
  },
  {
    title: "5. 운영 조치",
    content:
      "운영팀은 신고 접수 또는 모니터링 결과에 따라 콘텐츠 숨김, 삭제, 계정 이용 제한 등 필요한 조치를 할 수 있어요.",
  },
  {
    title: "6. 고지 및 개정",
    content:
      "관련 법령, 서비스 정책, 운영 환경이 변경되면 본 규칙은 업데이트될 수 있으며, 변경 사항은 서비스 내에서 안내해 드려요.",
  },
];

export default function CommunityRulesPage() {
  const router = useRouter();

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
          <h1 className="text-base font-semibold">공연 커뮤니티 이용규칙</h1>
          <div className="w-9" />
        </header>

        <div className="space-y-6 rounded-xl border border-black/5 bg-white p-4 text-sm text-[#17171c]">
          <p className="text-xs text-[#17171c]/60">시행일: 2026.03.03</p>
          <p className="text-[#17171c]/70">
            마이발레는 공연 커뮤니티를 안전하고 신뢰할 수 있는 공간으로 유지하기 위해 아래 기준을
            운영하고 있어요.
          </p>
          <div className="space-y-5">
            {COMMUNITY_RULES.map((item) => (
              <section key={item.title} className="space-y-2">
                <h2 className="text-sm font-semibold">{item.title}</h2>
                <p className="text-[#17171c]/70">{item.content}</p>
              </section>
            ))}
          </div>
        </div>
      </main>
    </MobileContainer>
  );
}

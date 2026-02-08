"use client";

import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

const PRIVACY_ITEMS = [
  {
    title: "1. 수집하는 개인정보 항목",
    content:
      "계정 정보(이메일), 프로필 정보(닉네임, 프로필 이미지), 기록 정보(날짜/시간/메모/기분/사진 등)를 수집합니다.",
  },
  {
    title: "2. 수집 및 이용 목적",
    content:
      "서비스 제공, 이용자 식별, 기록 보관, 고객 문의 대응을 위해 개인정보를 이용합니다.",
  },
  {
    title: "3. 보유 및 이용 기간",
    content:
      "회원 탈퇴 시 지체 없이 파기하며, 관련 법령에 따라 보관이 필요한 경우 해당 기간 동안 보관합니다.",
  },
  {
    title: "4. 제3자 제공",
    content:
      "회사는 원칙적으로 개인정보를 외부에 제공하지 않습니다. 다만 법령에 근거한 경우는 예외로 합니다.",
  },
  {
    title: "5. 처리 위탁",
    content:
      "서비스 운영을 위해 클라우드/SaaS(Supabase 등)를 이용할 수 있으며, 관련 사실은 고지합니다.",
  },
  {
    title: "6. 이용자 권리",
    content:
      "이용자는 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다.",
  },
  {
    title: "7. 개인정보 보호책임자",
    content:
      "[회사명] / [담당자] / [연락처] / [이메일]",
  },
];

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <MobileContainer>
      <main className="px-4 pb-12 pt-6">
        <header className="mb-6 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-[#17171c]/70"
            onClick={() => router.back()}
            aria-label="뒤로"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-semibold">개인정보 처리방침</h1>
          <div className="w-9" />
        </header>

        <div className="space-y-6 rounded-xl border border-black/5 bg-white p-4 text-sm text-[#17171c]">
          <p className="text-xs text-[#17171c]/60">
            시행일: [YYYY.MM.DD]
          </p>
          <p className="text-[#17171c]/70">
            본 방침은 개인정보 보호법 등 관련 법령에 따른 기본 항목을 포함합니다.
            실제 수집 항목과 운영 방식에 맞게 내용을 보완해 주세요.
          </p>
          <div className="space-y-5">
            {PRIVACY_ITEMS.map((item) => (
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

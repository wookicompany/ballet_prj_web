"use client";

import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

const TERMS = [
  {
    title: "제1조 (목적)",
    content:
      "본 약관은 [서비스명]의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.",
  },
  {
    title: "제2조 (정의)",
    content:
      "‘서비스’란 회사가 제공하는 발레 기록/캘린더 관리 기능 및 관련 부가서비스를 말합니다.",
  },
  {
    title: "제3조 (약관의 효력 및 변경)",
    content:
      "회사는 관련 법령을 위배하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 공지합니다.",
  },
  {
    title: "제4조 (서비스 제공)",
    content:
      "회사는 서비스의 안정적인 제공을 위해 노력하며, 시스템 점검 등 필요한 경우 사전 공지 후 일시 중단할 수 있습니다.",
  },
  {
    title: "제5조 (이용자의 의무)",
    content:
      "이용자는 관계 법령 및 본 약관을 준수해야 하며, 서비스 운영을 방해하는 행위를 해서는 안 됩니다.",
  },
  {
    title: "제6조 (계약 해지)",
    content:
      "이용자는 언제든지 서비스 내 제공되는 방법으로 이용계약을 해지할 수 있습니다.",
  },
  {
    title: "제7조 (책임 제한)",
    content:
      "회사는 천재지변, 불가항력 등 회사의 책임 없는 사유로 서비스를 제공할 수 없는 경우 책임을 지지 않습니다.",
  },
  {
    title: "제8조 (분쟁 해결)",
    content:
      "본 약관과 관련하여 분쟁이 발생할 경우 관련 법령 및 관할 법원에 따릅니다.",
  },
];

export default function TermsPage() {
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
          <h1 className="text-base font-semibold">서비스 이용약관</h1>
          <div className="w-9" />
        </header>

        <div className="space-y-6 rounded-xl border border-black/5 bg-white p-4 text-sm text-[#17171c]">
          <p className="text-xs text-[#17171c]/60">
            시행일: [YYYY.MM.DD]
          </p>
          <p className="text-[#17171c]/70">
            본 약관은 서비스 이용을 위한 기본적인 조건을 안내합니다. 실제
            서비스 운영 정보에 맞게 내용을 보완해 주세요.
          </p>
          <div className="space-y-5">
            {TERMS.map((item) => (
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

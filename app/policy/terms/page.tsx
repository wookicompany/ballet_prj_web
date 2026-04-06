"use client";

import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

const TERMS = [
  {
    title: "제1조 (목적)",
    content:
      "본 약관은 마이발레(이하 \"서비스\") 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.",
  },
  {
    title: "제2조 (정의)",
    content:
      "'서비스'란 회사가 제공하는 발레 기록 및 캘린더 관리, 공연 정보 조회, 브랜드 정보 조회 및 찜하기, 리뷰·댓글 작성, 신고, 문의하기, 알림, 운동 데이터 연동 기능과 그에 부수하는 서비스를 말합니다.",
  },
  {
    title: "제3조 (약관의 효력 및 변경)",
    content:
      "회사는 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 중요한 내용 변경 시 서비스 내 공지로 안내합니다.",
  },
  {
    title: "제4조 (계정 및 이용계약)",
    content:
      "이용자는 소셜 로그인 등 회사가 정한 방식으로 계정을 생성할 수 있습니다. 계정 정보는 본인이 관리해야 하며, 계정의 부정 사용이 의심될 경우 즉시 회사에 알려야 합니다.",
  },
  {
    title: "제5조 (서비스 제공 및 변경)",
    content:
      "회사는 서비스의 안정적 제공을 위해 노력합니다. 운영상 또는 기술상 필요에 따라 서비스의 전부 또는 일부를 변경할 수 있으며, 중요한 변경은 사전 공지합니다. 외부 플랫폼 또는 제휴/연동 서비스 정책, 장애, 종료 등 회사가 통제하기 어려운 사유로 일부 기능 제공이 제한될 수 있습니다.",
  },
  {
    title: "제6조 (외부 데이터 출처)",
    content:
      "서비스 내 공연 정보는 KOPIS(공연예술통합전산망) API 데이터를 기반으로 제공됩니다. KOPIS는 (재)예술경영지원센터가 운영하는 공식 공연 정보 서비스입니다. 사이트 주소는 www.kopis.or.kr입니다.",
  },
  {
    title: "제7조 (이용자의 의무)",
    content:
      "이용자는 관련 법령과 본 약관을 준수해야 하며, 타인의 권리를 침해하거나 서비스 운영을 방해하는 행위를 해서는 안 됩니다. 욕설·혐오·괴롭힘, 허위사실 게시, 비정상적인 신고 남용 등은 제한될 수 있습니다.",
  },
  {
    title: "제8조 (이용자의 콘텐츠)",
    content:
      "이용자가 서비스에 입력·업로드한 기록 및 콘텐츠에 대한 권리는 이용자에게 있습니다. 회사는 서비스 제공 및 개선을 위해 필요한 범위에서만 이를 사용합니다. 법령 또는 운영정책 위반이 확인되거나 다수 이용자 신고가 접수된 콘텐츠는 노출 제한, 삭제 등 필요한 조치를 할 수 있습니다.",
  },
  {
    title: "제9조 (계약 해지)",
    content:
      "이용자는 언제든지 서비스 내 제공되는 방법으로 이용계약을 해지할 수 있습니다. 해지 시 계정 및 기록은 관련 법령과 정책에 따라 처리됩니다.",
  },
  {
    title: "제10조 (책임 제한)",
    content:
      "회사는 천재지변, 불가항력 등 회사의 책임 없는 사유로 서비스를 제공할 수 없는 경우 책임을 지지 않습니다. 외부 데이터 제공처 또는 플랫폼 연동 과정에서 발생한 지연, 누락, 정확도 이슈에 대해서도 회사의 고의 또는 중대한 과실이 없는 한 책임이 제한됩니다. 서비스 내 브랜드 정보에 포함된 외부 링크를 통해 연결되는 타사 사이트의 내용, 서비스 및 개인정보 처리 방식에 대해 회사는 책임을 지지 않습니다.",
  },
  {
    title: "제11조 (분쟁 해결)",
    content:
      "본 약관과 관련하여 분쟁이 발생할 경우 관련 법령에 따르며, 관할 법원에서 해결합니다.",
  },
];

export default function TermsPage() {
  const router = useRouter();

  return (
    <MobileContainer>
      <main className="px-4 pb-12">
        <header className="sticky top-0 z-20 bg-white h-12 mb-6 flex items-center justify-between">
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
          <h1 className="text-base font-semibold">서비스 이용약관</h1>
          <div className="w-9" />
        </header>

        <div className="space-y-6 rounded-xl border border-[#17171c]/5 bg-white p-4 text-sm text-[#17171c]">
          <p className="text-xs text-[#17171c]/60">
            시행일: 2026.03.15
          </p>
          <p className="text-[#17171c]/70">
            본 약관은 마이발레 서비스 이용을 위한 조건과 기준을 안내합니다.
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

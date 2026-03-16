"use client";

import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

const PRIVACY_ITEMS = [
  {
    title: "1. 수집하는 개인정보 항목",
    content:
      "계정 정보(이메일), 프로필 정보(닉네임, 프로필 이미지), 기록 정보(날짜/시간/내용/기분/사진/장소), 커뮤니티 이용 정보(리뷰/댓글/좋아요/신고), 문의 접수 정보(답변 이메일, 제목, 내용, 닉네임), 푸시 알림 토큰(expo_push_token), 앱 플랫폼 정보(iOS/Android), 운동 동기화 정보(활동명, 기기/소스 정보, 칼로리, 심박수)를 수집할 수 있습니다.",
  },
  {
    title: "2. 수집 및 이용 목적",
    content:
      "서비스 제공 및 운영, 이용자 식별과 인증, 기록 보관, 리뷰/댓글 등 커뮤니티 운영, 신고 처리, 고객 문의 답변, 푸시 알림 발송, 플랫폼별 기능 제공, 운동 데이터 연동 기능 제공을 위해 개인정보를 이용합니다.",
  },
  {
    title: "3. 보유 및 이용 기간",
    content:
      "회원 탈퇴 시 관련 데이터는 삭제 처리됩니다. 푸시 알림 토큰은 로그아웃/탈퇴 시 삭제되며, 운동 동기화 정보는 이용자가 저장한 기록 데이터의 일부로 보관됩니다. 다만 문의 내역은 분쟁 대응 및 서비스 품질 개선을 위해 일정 기간 보관할 수 있으며, 관련 법령에 따라 보관이 필요한 경우에는 해당 법령에서 정한 기간 동안 보관합니다.",
  },
  {
    title: "4. 제3자 제공",
    content:
      "회사는 원칙적으로 개인정보를 외부에 제공하지 않습니다. 다만 법령에 근거한 경우에는 예외로 합니다.",
  },
  {
    title: "5. 처리 위탁",
    content:
      "서비스 운영을 위해 클라우드/SaaS(예: Supabase, Vercel), 푸시 알림 연동 서비스(예: Expo), 소셜 로그인 제공자(카카오, 구글, 애플), 플랫폼 기능 제공자(Apple/Google)를 이용할 수 있으며, 위탁 또는 제공 관계가 변경될 경우 관련 사실을 안내합니다.",
  },
  {
    title: "6. 이용자 권리",
    content:
      "이용자는 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있으며 앱 내 문의 기능을 통해 요청할 수 있습니다. 이용자는 기기 설정 또는 앱 권한 설정에서 알림 수신 및 건강 데이터 접근 권한을 변경하거나 철회할 수 있습니다.",
  },
  {
    title: "7. 개인정보 보호책임자",
    content:
      "마이발레 운영팀 / 앱 내 문의하기",
  },
  {
    title: "8. 고지의 의무",
    content:
      "본 방침은 법령, 정책 또는 서비스 변경에 따라 변경될 수 있으며, 변경 시 서비스 내 공지를 통해 안내합니다.",
  },
];

export default function PrivacyPage() {
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
          <h1 className="text-base font-semibold">개인정보 처리방침</h1>
          <div className="w-9" />
        </header>

        <div className="space-y-6 rounded-xl border border-black/5 bg-white p-4 text-sm text-[#17171c]">
          <p className="text-xs text-[#17171c]/60">
            시행일: 2026.03.15
          </p>
          <p className="text-[#17171c]/70">
            마이발레는 개인정보 보호법 등 관련 법령을 준수하며 개인정보를 안전하게 관리합니다.
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

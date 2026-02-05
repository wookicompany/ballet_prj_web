"use client";

import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";

export default function FloatingButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { openLoginSheet } = useLoginSheet();

  const isCalendar = pathname.startsWith("/calendar");

  if (!isCalendar) {
    return null;
  }

  return (
    <Button
      type="button"
      size="icon-lg"
      className="fixed bottom-[72px] right-4 z-20 rounded-full bg-[#17171c] text-white shadow-lg hover:bg-[#17171c]/90"
      aria-label="기록 생성"
      onClick={() => {
        if (!user) {
          openLoginSheet();
          return;
        }
        router.push("/record/new");
      }}
    >
      <span className="text-[28px] leading-none">+</span>
    </Button>
  );
}

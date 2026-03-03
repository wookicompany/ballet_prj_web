"use client";

import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { useConsentSheet } from "@/components/auth/ConsentSheetProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function FloatingButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const { ensureConsent } = useConsentSheet();

  const isCalendarHome = pathname === "/calendar";
  const isCalendarRelated = pathname.startsWith("/calendar");

  if (!isCalendarRelated || isCalendarHome) {
    return null;
  }

  return (
    <div className="fixed bottom-[72px] left-1/2 z-20 flex w-full max-w-[430px] -translate-x-1/2 justify-end px-4">
      <Button
        type="button"
        size="icon-lg"
        className="size-12 rounded-full bg-[#17171c] text-white shadow-lg hover:bg-[#17171c]/90"
        aria-label="기록 생성"
        onClick={async () => {
          if (!user) {
            openLoginSheet();
            return;
          }
          const consentOk = await ensureConsent();
          if (!consentOk) return;
          router.push("/record/new");
        }}
      >
        <Plus className="size-6" strokeWidth={3} />
      </Button>
    </div>
  );
}

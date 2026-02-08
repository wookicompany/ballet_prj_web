"use client";

import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { useConsentSheet } from "@/components/auth/ConsentSheetProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Calendar, User } from "lucide-react";

export default function TabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const { ensureConsent } = useConsentSheet();

  const isCalendar = pathname.startsWith("/calendar");
  const isProfile = pathname.startsWith("/profile");

  return (
    <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 border-t border-black/5 bg-white">
      <div className="grid h-14 grid-cols-2">
        <Button
          variant="ghost"
          className={`h-full flex-col gap-1 rounded-none text-[11px] hover:bg-transparent active:bg-transparent ${
            isCalendar ? "font-bold text-[#17171c]" : "text-[#17171c]/60"
          }`}
          onClick={() => router.push("/calendar")}
          type="button"
        >
          <Calendar className="h-5 w-5" />
          캘린더
        </Button>
        <Button
          variant="ghost"
          className={`h-full flex-col gap-1 rounded-none text-[11px] hover:bg-transparent active:bg-transparent ${
            isProfile ? "font-bold text-[#17171c]" : "text-[#17171c]/60"
          }`}
          onClick={async () => {
            if (!user) {
              openLoginSheet();
              return;
            }
            const consentOk = await ensureConsent();
            if (!consentOk) return;
            router.push("/profile");
          }}
          type="button"
        >
          <User className="h-5 w-5" />
          프로필
        </Button>
      </div>
    </nav>
  );
}

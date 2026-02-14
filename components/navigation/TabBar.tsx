"use client";

import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { useConsentSheet } from "@/components/auth/ConsentSheetProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Calendar, Theater, User } from "lucide-react";

export default function TabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const { ensureConsent } = useConsentSheet();

  const isCalendar = pathname.startsWith("/calendar");
  const isPerformance = pathname.startsWith("/performance");
  const isProfile = pathname.startsWith("/profile");

  return (
    <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 border-t border-black/5 bg-white">
      <div className="grid h-14 grid-cols-3">
        <Button
          variant="ghost"
          className={`h-full flex-col gap-1 rounded-none text-[10px] hover:bg-transparent active:bg-transparent ${
            isCalendar ? "font-bold text-[#17171c]" : "text-[#17171c]/60"
          }`}
          onClick={() => router.push("/calendar")}
          type="button"
        >
          <Calendar className="h-6 w-6" />
          캘린더
        </Button>
        <Button
          variant="ghost"
          className={`h-full flex-col gap-1 rounded-none text-[10px] hover:bg-transparent active:bg-transparent ${
            isPerformance ? "font-bold text-[#17171c]" : "text-[#17171c]/60"
          }`}
          onClick={() => router.push("/performance")}
          type="button"
        >
          <Theater className="h-6 w-6" />
          공연
        </Button>
        <Button
          variant="ghost"
          className={`h-full flex-col gap-1 rounded-none text-[10px] hover:bg-transparent active:bg-transparent ${
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
          <User className="h-6 w-6" />
          프로필
        </Button>
      </div>
    </nav>
  );
}

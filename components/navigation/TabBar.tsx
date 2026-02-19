"use client";

import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { useConsentSheet } from "@/components/auth/ConsentSheetProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Calendar, Theater, User } from "lucide-react";

const PERFORMANCE_TAB_ENTRY_KEY = "performance_tab_entry_token";
const PROFILE_TAB_ENTRY_KEY = "profile_tab_entry_token";

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
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[430px] border-t border-black/5 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="grid h-14 grid-cols-3">
        <Button
          variant="ghost"
          className={`h-full flex-col gap-1 rounded-none text-[10px] hover:bg-transparent active:bg-transparent ${
            isCalendar ? "font-bold text-[#17171c]" : "text-[#17171c]/60"
          }`}
          onClick={() => router.push("/calendar")}
          type="button"
        >
          <Calendar className="size-5" />
          캘린더
        </Button>
        <Button
          variant="ghost"
          className={`h-full flex-col gap-1 rounded-none text-[10px] hover:bg-transparent active:bg-transparent ${
            isPerformance ? "font-bold text-[#17171c]" : "text-[#17171c]/60"
          }`}
          onClick={() => {
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem(
                PERFORMANCE_TAB_ENTRY_KEY,
                `${Date.now()}`
              );
            }
            router.push("/performance");
          }}
          type="button"
        >
          <Theater className="size-5" />
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
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem(
                PROFILE_TAB_ENTRY_KEY,
                `${Date.now()}`
              );
            }
            router.push("/profile");
          }}
          type="button"
        >
          <User className="size-5" />
          프로필
        </Button>
      </div>
    </nav>
  );
}

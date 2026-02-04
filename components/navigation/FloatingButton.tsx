"use client";

import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";

export default function FloatingButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const isCalendar = pathname.startsWith("/calendar");

  if (!isCalendar) {
    return null;
  }

  return (
    <Button
      type="button"
      size="icon-lg"
      className="fixed bottom-20 right-1/2 z-20 translate-x-[190px] rounded-full bg-[#17171c] text-white shadow-lg hover:bg-[#17171c]/90"
      aria-label="기록 생성"
      onClick={() => {
        if (!user) {
          router.push("/login");
          return;
        }
        router.push("/record/new");
      }}
    >
      <span className="text-2xl leading-none">+</span>
    </Button>
  );
}

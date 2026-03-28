"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AnimatedImage from "@/components/ui/animated-image";
import { getAccessToken } from "@/lib/authSession";
import { ChevronLeft, User } from "lucide-react";
import { toast } from "sonner";

type AccountPayload = {
  avatar_url: string | null;
  nickname: string | null;
  email: string | null;
  provider: "kakao" | "apple" | "google" | "unknown";
  created_at: string | null;
};

const providerLabelMap: Record<AccountPayload["provider"], string> = {
  kakao: "카카오",
  apple: "애플",
  google: "구글",
  unknown: "알 수 없음",
};

const formatCreatedAt = (iso: string | null) => {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  if (!year || !month || !day) return "-";
  return `${year}.${month}.${day}`;
};

export default function ProfileAccountInfoPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [account, setAccount] = useState<AccountPayload | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);

  const fallbackNickname = useMemo(() => {
    if (!user) return "-";
    return user.id.slice(0, 8);
  }, [user]);

  useEffect(() => {
    const fetchAccount = async () => {
      if (loading) return;
      if (!user) {
        openLoginSheet();
        return;
      }

      setLoadingAccount(true);
      const accessToken = await getAccessToken(openLoginSheet);
      if (!accessToken) {
        setLoadingAccount(false);
        return;
      }

      try {
        const response = await fetch("/api/account/me", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (!response.ok) {
          toast("계정 정보를 불러오지 못했어요.");
          setLoadingAccount(false);
          return;
        }
        const payload = (await response.json()) as { account?: AccountPayload };
        setAccount(payload.account ?? null);
      } finally {
        setLoadingAccount(false);
      }
    };

    void fetchAccount();
  }, [user, loading, openLoginSheet]);

  if (loading || loadingAccount) {
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
            <h1 className="text-base font-semibold">계정 정보</h1>
            <div className="w-9" />
          </header>

          <section className="rounded-xl border border-[#17171c]/5 bg-white p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-14 w-14 rounded-full shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-5 w-24" />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-[#17171c]/5 px-3 py-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#17171c]/5 px-3 py-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#17171c]/5 px-3 py-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </section>
        </main>
      </MobileContainer>
    );
  }

  if (!user) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen items-center justify-center px-4 text-sm text-[#17171c]/70">
          로그인이 필요해요.
        </main>
      </MobileContainer>
    );
  }

  const displayNickname = account?.nickname?.trim() || fallbackNickname;
  const displayEmail = account?.email ?? "-";
  const displayProvider = providerLabelMap[account?.provider ?? "unknown"];
  const displayCreatedAt = formatCreatedAt(account?.created_at ?? null);

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
          <h1 className="text-base font-semibold">계정 정보</h1>
          <div className="w-9" />
        </header>

        <section className="rounded-xl border border-[#17171c]/5 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 overflow-hidden rounded-full border border-[#17171c]/10 bg-[#17171c]/5">
              {account?.avatar_url ? (
                <AnimatedImage
                  src={account.avatar_url}
                  alt="프로필 사진"
                  width={56}
                  height={56}
                  sizes="56px"
                  draggable={false}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#17171c]/60">
                  <User className="h-6 w-6" />
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-[#17171c]/60">닉네임</p>
              <p className="text-base font-semibold text-[#17171c]">{displayNickname}</p>
            </div>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-[#17171c]/5 px-3 py-2">
              <dt className="text-[#17171c]/60">이메일</dt>
              <dd className="text-right font-medium text-[#17171c]">{displayEmail}</dd>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-[#17171c]/5 px-3 py-2">
              <dt className="text-[#17171c]/60">로그인 방식</dt>
              <dd className="font-medium text-[#17171c]">{displayProvider}</dd>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-[#17171c]/5 px-3 py-2">
              <dt className="text-[#17171c]/60">계정 생성일</dt>
              <dd className="font-medium text-[#17171c]">{displayCreatedAt}</dd>
            </div>
          </dl>
        </section>
      </main>
    </MobileContainer>
  );
}

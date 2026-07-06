"use client";

import { useEffect, useState } from "react";
import AnimatedImage from "@/components/ui/animated-image";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { getAccessToken } from "@/lib/authSession";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { openUrlInApp } from "@/lib/reactNativeWebView";

type AdPayload = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
};

// 이번 세션(탭 전환으로 리마운트돼도) 한 번 확인했으면 재확인 안 함.
let dismissedThisSession = false;

export default function CalendarPopupAd() {
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [ad, setAd] = useState<AdPayload | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || !user || dismissedThisSession) return;
    let isActive = true;

    const checkAd = async () => {
      try {
        const [adRes, accessToken] = await Promise.all([
          fetch("/api/ads?placement=calendar_home", { cache: "no-store" }),
          getAccessToken(openLoginSheet),
        ]);
        if (!isActive || !adRes.ok || !accessToken) return;

        const { ad: fetched } = (await adRes.json()) as { ad: AdPayload | null };
        if (!fetched) return;

        const dismissedRes = await fetch(`/api/ads/${fetched.id}/dismissed`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        if (!isActive || !dismissedRes.ok) return;
        const { dismissed } = (await dismissedRes.json()) as { dismissed: boolean };
        if (dismissed) return;

        setAd(fetched);
        setOpen(true);
        // keepalive: 팝업 직후 앱 백그라운드 전환에도 요청이 살아남도록
        void fetch(`/api/ads/${fetched.id}/impression`, {
          method: "POST",
          keepalive: true,
        }).catch(() => {
          // 노출 추적은 부가 기능이라 실패해도 무시
        });
      } catch {
        // 부가 기능이라 실패해도 조용히 무시
      }
    };

    void checkAd();
    return () => {
      isActive = false;
    };
  }, [user, loading, openLoginSheet]);

  const handleDismissPermanently = async () => {
    if (!ad) return;
    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) return;
    try {
      await fetch(`/api/ads/${ad.id}/dismiss`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        keepalive: true,
      });
    } catch {
      // 실패 시 다음 진입 때 팝업이 다시 뜨는 fail-open 동작이라 무시
    }
  };

  const handleImageClick = async () => {
    if (!ad?.link_url) return;
    try {
      // keepalive: 클릭 직후 외부 링크 이동에 요청이 끊기지 않도록
      await fetch(`/api/ads/${ad.id}/click`, { method: "POST", keepalive: true });
    } catch {
      // 클릭 추적 실패는 무시
    }
    const opened = openUrlInApp(ad.link_url);
    if (!opened) window.open(ad.link_url, "_blank", "noopener,noreferrer");
  };

  if (!ad) return null;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          dismissedThisSession = true;
          setOpen(false);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{ad.title}</AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            팝업 광고
          </AlertDialogDescription>
        </AlertDialogHeader>
        {ad.description && (
          <div className="max-h-[30vh] overflow-y-auto text-left">
            <p className="whitespace-pre-wrap text-sm text-[#17171c]/80">
              {ad.description}
            </p>
          </div>
        )}
        {ad.image_url && (
          <button
            type="button"
            className="block w-full overflow-hidden rounded-lg"
            onClick={() => void handleImageClick()}
            aria-label={ad.title}
          >
            <AnimatedImage
              src={ad.image_url}
              alt={ad.title}
              width={800}
              height={800}
              unoptimized
              className="h-auto max-h-[60vh] w-full object-contain"
            />
          </button>
        )}
        <AlertDialogFooter className="flex flex-row gap-2">
          <AlertDialogCancel className="flex-1">닫기</AlertDialogCancel>
          <AlertDialogAction
            className="flex-1"
            onClick={() => {
              void handleDismissPermanently();
            }}
          >
            다시보지 않기
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

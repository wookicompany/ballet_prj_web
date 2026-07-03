"use client";

import { useEffect, useState } from "react";
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

type NoticeDetail = { id: string; title: string; content: string };

// 이번 세션(탭 새로고침/앱 재시작 전까지) 동안 한 번 확인했으면 재확인 안 함.
// 하단 탭 전환마다 캘린더 페이지가 리마운트돼도 매번 안 뜨게 하기 위한
// 모듈 스코프 플래그 (lib/*Cache.ts들의 in-memory 캐시 관례와 동일).
let dismissedThisSession = false;

export default function NoticePopup() {
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [notice, setNotice] = useState<NoticeDetail | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || !user || dismissedThisSession) return;
    let isActive = true;

    const checkUnreadNotice = async () => {
      try {
        const [listRes, accessToken] = await Promise.all([
          fetch("/api/notices", { cache: "no-store" }),
          getAccessToken(openLoginSheet),
        ]);
        if (!isActive || !listRes.ok || !accessToken) return;

        const { items } = (await listRes.json()) as {
          items: { id: string; title: string }[];
        };

        const statusRes = await fetch("/api/notices/read-status", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        if (!isActive || !statusRes.ok) return;
        const { read_notice_ids } = (await statusRes.json()) as {
          read_notice_ids: string[];
        };

        const target = items.find((item) => !read_notice_ids.includes(item.id));
        if (!target) return;

        const detailRes = await fetch(`/api/notices/${target.id}`);
        if (!isActive || !detailRes.ok) return;
        const { item } = (await detailRes.json()) as { item: NoticeDetail | null };
        if (!isActive || !item) return;

        setNotice(item);
        setOpen(true);
      } catch {
        // 부가 기능이라 실패해도 사용자에게 노출하지 않고 조용히 무시
      }
    };

    checkUnreadNotice();
    return () => {
      isActive = false;
    };
  }, [user, loading, openLoginSheet]);

  const handleMarkAsRead = async () => {
    if (!notice) return;
    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) return;
    await fetch(`/api/notices/${notice.id}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  };

  if (!notice) return null;

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
          <AlertDialogTitle>{notice.title}</AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            공지사항 내용
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-[45vh] overflow-y-auto text-left">
          <p className="whitespace-pre-wrap text-sm text-[#17171c]/80">
            {notice.content}
          </p>
        </div>
        <AlertDialogFooter className="flex flex-row gap-2">
          <AlertDialogCancel className="flex-1">닫기</AlertDialogCancel>
          <AlertDialogAction
            className="flex-1"
            onClick={() => {
              void handleMarkAsRead();
            }}
          >
            다시보지 않기
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
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
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import {
  sendAccountDeletedToApp,
  sendLogoutToApp,
} from "@/lib/reactNativeWebView";
import { supabase } from "@/lib/supabaseClient";
import { ensureSessionOrLogin, getAccessToken } from "@/lib/authSession";
import { buildKakaoAccountLogoutUrl } from "@/lib/oauthProvider";
import {
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Database,
  LogOut,
  MessageCircle,
  ShieldCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

export default function ProfileMenuPage() {
  const router = useRouter();
  const { user, provider, loading, signOut } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasUnreadNotices, setHasUnreadNotices] = useState(false);

  useEffect(() => {
    const fetchNoticeReadStatus = async () => {
      if (loading) return;
      if (!user) {
        setHasUnreadNotices(false);
        return;
      }

      const accessToken = await getAccessToken(openLoginSheet);
      if (!accessToken) {
        setHasUnreadNotices(false);
        return;
      }

      const response = await fetch("/api/notices/read-status", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) {
        setHasUnreadNotices(false);
        return;
      }

      const payload = (await response.json()) as { has_unread?: boolean };
      setHasUnreadNotices(payload.has_unread === true);
    };

    void fetchNoticeReadStatus();
  }, [user, loading, openLoginSheet]);

  const handleLogout = async () => {
    if (!user || loading) return;
    if (provider === "kakao") {
      const restApiKey = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;
      if (!restApiKey) {
        toast("카카오 로그아웃 설정을 확인해 주세요.");
        return;
      }

      await signOut();
      const logoutRedirectUri = `${window.location.origin}/auth/kakao/logout/callback`;
      const logoutUrl = buildKakaoAccountLogoutUrl({
        restApiKey,
        logoutRedirectUri,
        state: String(Date.now()),
      });
      window.location.assign(logoutUrl);
      return;
    }

    if (provider === "apple" || provider === "google" || provider === "unknown") {
      // RN이 유효한 액세스 토큰으로 해제 API를 호출할 수 있도록
      // 로그아웃 이벤트를 세션 정리 직전에 전송한다.
      sendLogoutToApp();
      await supabase.auth.signOut({ scope: "local" });
      router.replace("/calendar");
      return;
    }

    sendLogoutToApp();
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/calendar");
  };

  const handleDeleteAccount = async () => {
    if (!user || loading || isDeleting) return;
    setIsDeleting(true);
    try {
      const session = await ensureSessionOrLogin(openLoginSheet);
      if (!session) {
        toast("로그인 정보가 없어요. 다시 로그인해 주세요.");
        return;
      }
      const accessToken = session.access_token;

      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refresh_token: session.refresh_token ?? null,
        }),
      });
      if (!response.ok) {
        let errorMessage = "회원탈퇴에 실패했습니다. 잠시 후 다시 시도해 주세요.";
        try {
          const errorBody = await response.json();
          if (errorBody?.message) {
            errorMessage = `회원탈퇴에 실패했습니다. (${errorBody.message})`;
          }
        } catch {
          // ignore parse errors
        }
        toast(errorMessage);
        return;
      }

      // RN이 유효한 액세스 토큰으로 해제 API를 호출할 수 있도록
      // 탈퇴 이벤트를 세션 정리 직전에 전송한다.
      sendAccountDeletedToApp();
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // 회원탈퇴 성공 후에는 로컬 세션 정리가 실패해도 화면 전환을 우선한다.
      } finally {
        router.replace("/calendar");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen items-center justify-center">
          <Spinner size="lg" />
        </main>
      </MobileContainer>
    );
  }

  return (
    <MobileContainer>
      {isDeleting ? <LoadingOverlay /> : null}
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
          <h1 className="text-base font-semibold">더보기</h1>
          <div className="w-9" />
        </header>

        <section className="divide-y divide-black/5 rounded-xl border border-black/5 bg-white">
          <Button
            type="button"
            variant="ghost"
            className="h-14 w-full justify-between px-4"
            onClick={() => router.push("/calendar/settings")}
          >
            <span className="flex items-center gap-3 text-sm text-[#17171c]">
              <Calendar className="h-5 w-5 text-[#17171c]/70" />
              캘린더 설정
            </span>
            <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-14 w-full justify-between px-4"
            onClick={() => router.push("/profile/data-management")}
          >
            <span className="flex items-center gap-3 text-sm text-[#17171c]">
              <Database className="h-5 w-5 text-[#17171c]/70" />
              데이터 관리
            </span>
            <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-14 w-full justify-between px-4"
            onClick={() => router.push("/notice")}
          >
            <span className="flex items-center gap-3 text-sm text-[#17171c]">
              <Bell className="h-5 w-5 text-[#17171c]/70" />
              <span className="inline-flex items-center gap-2">
                공지사항
                {hasUnreadNotices ? (
                  <span className="h-2 w-2 rounded-full bg-[#FF154A]" />
                ) : null}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-14 w-full justify-between px-4"
            onClick={() => router.push("/policy")}
          >
            <span className="flex items-center gap-3 text-sm text-[#17171c]">
              <ShieldCheck className="h-5 w-5 text-[#17171c]/70" />
              서비스 이용정책
            </span>
            <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-14 w-full justify-between px-4"
            onClick={() => router.push("/support")}
          >
            <span className="flex items-center gap-3 text-sm text-[#17171c]">
              <MessageCircle className="h-5 w-5 text-[#17171c]/70" />
              문의하기
            </span>
            <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
          </Button>
        </section>

        <div className="my-6 h-px w-full bg-black/5" />

        <section className="divide-y divide-black/5 rounded-xl border border-black/5 bg-white">
          <Button
            type="button"
            variant="ghost"
            className="h-14 w-full justify-between px-4"
            onClick={handleLogout}
          >
            <span className="flex items-center gap-3 text-sm text-[#17171c]">
              <LogOut className="h-5 w-5 text-[#17171c]/70" />
              로그아웃
            </span>
            <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-14 w-full justify-between px-4"
            disabled={isDeleting}
            onClick={() => setDeleteDialogOpen(true)}
          >
            <span className="flex items-center gap-3 text-sm text-[#17171c]">
              <UserX className="h-5 w-5 text-[#17171c]/70" />
              회원탈퇴
            </span>
            <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
          </Button>
        </section>
        <AlertDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            if (isDeleting) return;
            setDeleteDialogOpen(open);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>회원탈퇴를 진행할까요?</AlertDialogTitle>
              <AlertDialogDescription>
                진행하면 모든 기록이 삭제되고 되돌릴 수 없어요.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-row gap-2">
              <AlertDialogCancel className="flex-1" disabled={isDeleting}>
                취소
              </AlertDialogCancel>
              <AlertDialogAction
                variant="outline"
                className="flex-1 text-red-500 hover:text-red-500"
                disabled={isDeleting}
                onClick={async () => {
                  setDeleteDialogOpen(false);
                  await handleDeleteAccount();
                }}
              >
                탈퇴할게요
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </MobileContainer>
  );
}

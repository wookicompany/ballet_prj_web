"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import PageHeader from "@/components/layout/PageHeader";
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
import { ensureSessionOrLogin } from "@/lib/authSession";
import { buildKakaoAccountLogoutUrl } from "@/lib/oauthProvider";
import { ChevronRight, LogOut, UserRound, UserX } from "lucide-react";
import { toast } from "sonner";

export default function ProfileAccountPage() {
  const router = useRouter();
  const { user, provider, loading, signOut } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  if (!user) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen items-center justify-center px-4 text-sm text-[#17171c]/70">
          로그인이 필요해요.
        </main>
      </MobileContainer>
    );
  }

  return (
    <MobileContainer>
      {isDeleting ? <LoadingOverlay /> : null}
      <main className="px-4 pb-12">
        <PageHeader title="계정 관리" className="mb-6" />

        <section className="divide-y divide-[#17171c]/5 rounded-xl border border-[#17171c]/5 bg-white">
          <Button
            type="button"
            variant="ghost"
            className="h-14 w-full justify-between px-4"
            onClick={() => router.push("/profile/account/info")}
          >
            <span className="flex items-center gap-3 text-sm text-[#17171c]">
              <UserRound className="h-5 w-5 text-[#17171c]/70" />
              계정 정보
            </span>
            <ChevronRight className="h-4 w-4 text-[#17171c]/40" />
          </Button>
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

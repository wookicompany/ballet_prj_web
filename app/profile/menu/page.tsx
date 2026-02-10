"use client";

import { useState } from "react";
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
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/lib/supabaseClient";
import { ensureSessionOrLogin } from "@/lib/authSession";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  LogOut,
  MessageCircle,
  ShieldCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

export default function ProfileMenuPage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleLogout = async () => {
    if (!user || loading) return;
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/calendar");
  };

  const handleDeleteAccount = async () => {
    if (!user || loading) return;
    const session = await ensureSessionOrLogin(openLoginSheet);
    if (!session) {
      toast("로그인 정보가 없어요. 다시 로그인해 주세요.");
      return;
    }
    const accessToken = session.access_token;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      toast("설정 정보를 찾을 수 없어요. 다시 시도해 주세요.");
      return;
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/delete-account`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );
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
    await signOut();
    router.replace("/calendar");
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
      <main className="px-4 pb-12 pt-6">
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
          onOpenChange={setDeleteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>회원탈퇴를 진행할까요?</AlertDialogTitle>
              <AlertDialogDescription>
                진행하면 모든 기록이 삭제되고 되돌릴 수 없어요.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-row gap-2">
              <AlertDialogCancel className="flex-1">취소</AlertDialogCancel>
              <AlertDialogAction
                variant="outline"
                className="flex-1 text-red-500 hover:text-red-500"
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

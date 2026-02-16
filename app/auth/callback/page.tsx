"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import { sendAuthTokenToApp } from "@/lib/reactNativeWebView";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const failAndExit = (message?: string) => {
      toast(message ?? "로그인 처리를 완료하지 못했어요. 다시 로그인해 주세요.");
      router.replace("/calendar");
    };

    const tryReactivateAccount = async (token: string) => {
      const response = await fetch("/api/account/reactivate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        // 재활성화 실패는 로그인 자체를 막지 않는다.
        toast("계정 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    };

    const finishLogin = async (token: string) => {
      await tryReactivateAccount(token);
      sendAuthTokenToApp(token);
      router.replace("/calendar");
    };

    const handleCallback = async () => {
      try {
        const url = new URL(window.location.href);
        const oauthError = url.searchParams.get("error");
        if (oauthError) {
          if (oauthError === "access_denied") {
            failAndExit("로그인을 취소했어요. 다시 시도해 주세요.");
            return;
          }
          failAndExit();
          return;
        }

        const code = url.searchParams.get("code");
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(url.toString());

          if (exchangeError) {
            failAndExit();
            return;
          }

          const { data: sessionData } = await supabase.auth.getSession();
          const exchangedAccessToken = sessionData.session?.access_token ?? "";
          if (exchangedAccessToken) {
            await finishLogin(exchangedAccessToken);
            return;
          }

          failAndExit();
          return;
        }

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            failAndExit();
            return;
          }

          await finishLogin(accessToken);
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) {
          await finishLogin(data.session.access_token);
          return;
        }

        const { data: refreshedData, error: refreshError } =
          await supabase.auth.refreshSession();
        if (refreshError) {
          failAndExit();
          return;
        }

        if (refreshedData.session?.access_token) {
          await finishLogin(refreshedData.session.access_token);
          return;
        }

        failAndExit();
      } catch {
        failAndExit();
      }
    };

    handleCallback();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <Spinner size="lg" />
    </main>
  );
}

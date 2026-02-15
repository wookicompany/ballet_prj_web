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
    const tryReactivateAccount = async (token: string) => {
      const response = await fetch("/api/account/reactivate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        toast("계정 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    };

    const finishLogin = async (token: string) => {
      await tryReactivateAccount(token);
      sendAuthTokenToApp(token);
      router.replace("/calendar");
    };

    const handleCallback = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(url.toString());

        if (exchangeError) {
          toast(`로그인 처리 중 오류가 발생했습니다. (${exchangeError.message})`);
          return;
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const exchangedAccessToken = sessionData.session?.access_token ?? "";
        if (exchangedAccessToken) {
          await finishLogin(exchangedAccessToken);
          return;
        }

        toast("로그인 처리 중 오류가 발생했습니다. (액세스 토큰이 없습니다.)");
        return;
      }

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          toast(`로그인 처리 중 오류가 발생했습니다. (${sessionError.message})`);
          return;
        }

        await finishLogin(accessToken);
        return;
      }

      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        toast("로그인 처리 중 오류가 발생했습니다. (로그인 세션이 없습니다.)");
        return;
      }

      if (data.session.access_token) {
        await finishLogin(data.session.access_token);
        return;
      }

      toast("로그인 처리 중 오류가 발생했습니다. (액세스 토큰이 없습니다.)");
    };

    handleCallback();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <Spinner size="lg" />
    </main>
  );
}

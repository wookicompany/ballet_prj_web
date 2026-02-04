"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
          setError(
            `로그인 처리 중 오류가 발생했습니다. (${exchangeError.message})`
          );
          return;
        }

        router.replace("/calendar");
        return;
      }

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          setError(
            `로그인 처리 중 오류가 발생했습니다. (${sessionError.message})`
          );
          return;
        }

        router.replace("/calendar");
        return;
      }

      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        setError(
          "로그인 처리 중 오류가 발생했습니다. (로그인 세션이 없습니다.)"
        );
        return;
      }

      router.replace("/calendar");
    };

    handleCallback();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-[#17171c]">
        {error ?? "로그인 처리 중입니다..."}
      </p>
    </main>
  );
}

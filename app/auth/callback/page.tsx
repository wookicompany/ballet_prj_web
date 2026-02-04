"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(window.location.href);

      if (exchangeError) {
        setError(
          `로그인 처리 중 오류가 발생했습니다. (${exchangeError.message})`
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

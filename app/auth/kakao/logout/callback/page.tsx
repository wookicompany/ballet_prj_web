"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import { sendLogoutToApp } from "@/lib/reactNativeWebView";
import { Spinner } from "@/components/ui/spinner";

export default function KakaoLogoutCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const finishLogout = async () => {
      // RN이 유효한 액세스 토큰으로 해제 API를 호출할 수 있도록
      // 로그아웃 이벤트를 세션 정리 직전에 전송한다.
      sendLogoutToApp();
      await supabase.auth.signOut({ scope: "local" });
      router.replace("/calendar");
    };

    finishLogout();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <Spinner size="lg" />
    </main>
  );
}

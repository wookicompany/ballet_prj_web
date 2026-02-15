"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import { Spinner } from "@/components/ui/spinner";

export default function KakaoLogoutCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const finishLogout = async () => {
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

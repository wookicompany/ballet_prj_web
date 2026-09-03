"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";

import MobileContainer from "@/components/layout/MobileContainer";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabaseClient";
import { setHapticEnabled } from "@/lib/reactNativeWebView";
import { toast } from "sonner";

export default function GeneralSettingsPage() {
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [hapticOn, setHapticOn] = useState(true);

  useEffect(() => {
    if (!user) {
      setHapticOn(true);
      return;
    }

    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("haptic_enabled")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        setHapticOn(true);
        return;
      }

      if (data) {
        setHapticOn(data.haptic_enabled !== false);
      } else {
        setHapticOn(true);
        await supabase.from("profiles").upsert({
          id: user.id,
          haptic_enabled: true,
        });
      }
    };

    fetchSettings();
  }, [user]);

  const handleHapticChange = async (next: boolean) => {
    const previous = hapticOn;
    // 낙관적 반영: 로컬 state + 전역 게이트 즉시 적용
    setHapticOn(next);
    setHapticEnabled(next);

    const { error } = await supabase.from("profiles").upsert({
      id: user!.id,
      haptic_enabled: next,
    });

    if (error) {
      // all-or-nothing: 실패 시 로컬 state와 게이트를 이전 값으로 롤백
      setHapticOn(previous);
      setHapticEnabled(previous);
      toast("진동 설정 저장에 실패했습니다.");
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
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-[#17171c]/70">
            로그인이 필요한 화면이에요.
          </p>
          <Button
            type="button"
            className="bg-[#17171c] text-white"
            onClick={openLoginSheet}
          >
            로그인하고 계속하기
          </Button>
        </main>
      </MobileContainer>
    );
  }

  return (
    <MobileContainer>
      <main className="px-4 pb-16">
        <PageHeader title="앱 설정" className="mb-6" />

        <section className="divide-y divide-[#17171c]/5 rounded-xl border border-[#17171c]/5 bg-white">
          <div className="flex items-center justify-between px-4 py-4">
            <p className="text-sm font-medium text-[#17171c]">진동</p>
            <Switch
              size="lg"
              checked={hapticOn}
              onCheckedChange={handleHapticChange}
            />
          </div>
        </section>
      </main>
    </MobileContainer>
  );
}

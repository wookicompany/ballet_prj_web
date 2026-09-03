"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";

import MobileContainer from "@/components/layout/MobileContainer";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

export default function CalendarSettingsPage() {
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [weekStartMonday, setWeekStartMonday] = useState(false);
  const [highlightWeekend, setHighlightWeekend] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setWeekStartMonday(false);
      setHighlightWeekend(false);
      setSettingsLoaded(true);
      return;
    }

    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("calendar_week_start_monday,calendar_highlight_weekend")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        setWeekStartMonday(false);
        setHighlightWeekend(false);
        setSettingsLoaded(true);
        return;
      }

      if (data) {
        setWeekStartMonday(!!data.calendar_week_start_monday);
        setHighlightWeekend(!!data.calendar_highlight_weekend);
      } else {
        setWeekStartMonday(false);
        setHighlightWeekend(false);
        await supabase.from("profiles").upsert({
          id: user.id,
          calendar_week_start_monday: false,
          calendar_highlight_weekend: false,
        });
      }
      setSettingsLoaded(true);
    };

    fetchSettings();
  }, [user]);

  const isInitialSettingsLoad = useRef(true);
  const previousSettingsRef = useRef({ weekStartMonday, highlightWeekend });
  useEffect(() => {
    if (!settingsLoaded || !user) return;
    if (isInitialSettingsLoad.current) {
      isInitialSettingsLoad.current = false;
      previousSettingsRef.current = { weekStartMonday, highlightWeekend };
      return;
    }
    const previous = previousSettingsRef.current;
    const next = { weekStartMonday, highlightWeekend };
    if (
      next.weekStartMonday === previous.weekStartMonday &&
      next.highlightWeekend === previous.highlightWeekend
    ) {
      return;
    }
    const persistSettings = async () => {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        calendar_week_start_monday: next.weekStartMonday,
        calendar_highlight_weekend: next.highlightWeekend,
      });
      if (error) {
        // all-or-nothing: 저장 실패 시 이전 값으로 롤백
        setWeekStartMonday(previous.weekStartMonday);
        setHighlightWeekend(previous.highlightWeekend);
        toast("캘린더 설정 저장에 실패했습니다.");
        return;
      }
      previousSettingsRef.current = next;
    };
    void persistSettings();
  }, [weekStartMonday, highlightWeekend, user, settingsLoaded]);

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
        <PageHeader title="캘린더 설정" className="mb-6" />

        <section className="divide-y divide-[#17171c]/5 rounded-xl border border-[#17171c]/5 bg-white">
          <div className="flex items-center justify-between px-4 py-4">
            <p className="text-sm font-medium text-[#17171c]">
              월요일로 주간 시작
            </p>
            <Switch
              size="lg"
              checked={weekStartMonday}
              onCheckedChange={setWeekStartMonday}
            />
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <p className="text-sm font-medium text-[#17171c]">주말 색 표시</p>
            <Switch
              size="lg"
              checked={highlightWeekend}
              onCheckedChange={setHighlightWeekend}
            />
          </div>
        </section>
      </main>
    </MobileContainer>
  );
}

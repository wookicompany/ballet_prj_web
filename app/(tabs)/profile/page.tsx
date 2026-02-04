"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";
import { Settings } from "lucide-react";

type Profile = {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
};

function toMinutes(time: string) {
  const [hh, mm, ss] = time.split(":").map((value) => Number(value));
  return hh * 60 + mm + (ss ? Math.round(ss / 60) : 0);
}

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recordCount, setRecordCount] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        openLoginSheet();
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id,nickname,avatar_url")
        .eq("id", user.id)
        .single();

      if (!data) {
        await supabase.from("profiles").insert({ id: user.id });
        setProfile({ id: user.id, nickname: null, avatar_url: null });
      } else {
        setProfile(data as Profile);
      }

      const { data: records } = await supabase
        .from("records")
        .select("start_time,end_time")
        .eq("user_id", user.id)
        .is("deleted_at", null);

      if (records) {
        setRecordCount(records.length);
        const minutes = records.reduce((sum, record) => {
          return sum + (toMinutes(record.end_time) - toMinutes(record.start_time));
        }, 0);
        setTotalMinutes(minutes);
      }
    };

    fetchProfile();
  }, [user, router]);

  if (!user) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-sm text-[#17171c]/70">
            로그인하면 프로필을 볼 수 있어요.
          </p>
          <Button type="button" onClick={openLoginSheet}>
            로그인할게요
          </Button>
        </main>
      </MobileContainer>
    );
  }

  if (!profile) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-[#17171c]/70">프로필 로딩 중...</p>
        </main>
      </MobileContainer>
    );
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return (
    <MobileContainer>
      <main className="px-4 pb-10 pt-8">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold">프로필</h1>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-[#17171c]/70"
            onClick={() => router.push("/profile/edit")}
            aria-label="프로필 설정"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </header>

        <section className="mb-6 flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full border border-black/10 bg-black/5">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="프로필 이미지"
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div>
            <p className="text-base font-semibold">
              {profile.nickname ?? "마이발레"}
            </p>
            <p className="text-xs text-[#17171c]/60">{user?.email ?? ""}</p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Card className="border-black/5 shadow-none">
            <CardContent className="p-4">
              <p className="text-xs text-[#17171c]/60">총 기록 개수</p>
              <p className="text-lg font-semibold">{recordCount}개</p>
            </CardContent>
          </Card>
          <Card className="border-black/5 shadow-none">
            <CardContent className="p-4">
              <p className="text-xs text-[#17171c]/60">누적 발레 시간</p>
              <p className="text-lg font-semibold">
                {hours}시간 {minutes}분
              </p>
            </CardContent>
          </Card>
        </section>
      </main>
    </MobileContainer>
  );
}

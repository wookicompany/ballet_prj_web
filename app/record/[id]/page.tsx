"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft, Pencil } from "lucide-react";

type RecordDetail = {
  id: string;
  record_date: string;
  start_time: string;
  end_time: string;
  content: string;
  mood: number | null;
  location: string | null;
  level: string | null;
  instructor: string | null;
  bar_order: string | null;
  center_order: string | null;
  did_well: string | null;
  improve_next: string | null;
};

type MediaItem = {
  id: string;
  media_type: string;
  url: string;
};

const MOODS = ["😔", "🙁", "😐", "🙂", "😄"];

export default function RecordDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [record, setRecord] = useState<RecordDetail | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);

  useEffect(() => {
    const fetchRecord = async () => {
      if (loading) return;
      if (!user) {
        openLoginSheet();
        return;
      }

      const { data } = await supabase
        .from("records")
        .select(
          "id,record_date,start_time,end_time,content,mood,location,level,instructor,bar_order,center_order,did_well,improve_next"
        )
        .eq("id", params.id)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .single();

      setRecord((data as RecordDetail) ?? null);

      const { data: mediaData } = await supabase
        .from("record_media")
        .select("id,media_type,url")
        .eq("record_id", params.id)
        .eq("user_id", user.id);

      setMedia((mediaData as MediaItem[]) ?? []);
    };

    fetchRecord();
  }, [params.id, user, router, loading, openLoginSheet]);

  if (loading) {
    return null;
  }

  if (!user) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-sm text-[#17171c]/70">
            로그인하면 기록을 확인할 수 있어요.
          </p>
          <Button type="button" onClick={openLoginSheet}>
            로그인할게요
          </Button>
        </main>
      </MobileContainer>
    );
  }

  if (!record) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-[#17171c]/70">기록을 불러오는 중...</p>
        </main>
      </MobileContainer>
    );
  }

  const handleDelete = async () => {
    if (!user) return;
    const confirmed = window.confirm("이 기록을 삭제할까요?");
    if (!confirmed) return;

    await supabase
      .from("records")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", record.id)
      .eq("user_id", user.id);

    router.replace(`/day/${record.record_date}`);
  };

  return (
    <MobileContainer>
      <main className="px-4 pb-10 pt-6">
        <header className="mb-6 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-[#17171c]/70"
            onClick={() => router.back()}
            aria-label="뒤로"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-semibold">기록 상세</h1>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-[#17171c]/70"
            onClick={() => router.push(`/record/${record.id}/edit`)}
            aria-label="기록 수정"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </header>

        <div className="space-y-4 text-sm">
          <div className="rounded-lg border border-black/5 p-3">
            <p className="font-semibold">
              {record.start_time.slice(0, 5)} - {record.end_time.slice(0, 5)}
            </p>
            <p className="text-[#17171c]/70">{record.record_date}</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-[#17171c]/60">기록 내용</p>
            <p>{record.content}</p>
          </div>
          {record.mood ? (
            <div>
              <p className="mb-1 text-xs text-[#17171c]/60">감정 상태</p>
              <p className="text-lg">{MOODS[record.mood - 1]}</p>
            </div>
          ) : null}
          {record.location ? (
            <div>
              <p className="mb-1 text-xs text-[#17171c]/60">장소</p>
              <p>{record.location}</p>
            </div>
          ) : null}
          {record.level ? (
            <div>
              <p className="mb-1 text-xs text-[#17171c]/60">레벨</p>
              <p>{record.level}</p>
            </div>
          ) : null}
          {record.instructor ? (
            <div>
              <p className="mb-1 text-xs text-[#17171c]/60">강사</p>
              <p>{record.instructor}</p>
            </div>
          ) : null}
          {record.bar_order ? (
            <div>
              <p className="mb-1 text-xs text-[#17171c]/60">바 순서</p>
              <p>{record.bar_order}</p>
            </div>
          ) : null}
          {record.center_order ? (
            <div>
              <p className="mb-1 text-xs text-[#17171c]/60">센터 순서</p>
              <p>{record.center_order}</p>
            </div>
          ) : null}
          {record.did_well ? (
            <div>
              <p className="mb-1 text-xs text-[#17171c]/60">오늘 잘한 것</p>
              <p>{record.did_well}</p>
            </div>
          ) : null}
          {record.improve_next ? (
            <div>
              <p className="mb-1 text-xs text-[#17171c]/60">
                다음에 더 신경 써야 하는 것
              </p>
              <p>{record.improve_next}</p>
            </div>
          ) : null}
          {media.length > 0 ? (
            <div>
              <p className="mb-2 text-xs text-[#17171c]/60">미디어</p>
              <div className="grid grid-cols-2 gap-2">
                {media.map((item) =>
                  item.media_type === "video" ? (
                    <video
                      key={item.id}
                      controls
                      className="w-full rounded-md"
                    >
                      <source src={item.url} />
                    </video>
                  ) : (
                    <img
                      key={item.id}
                      src={item.url}
                      alt="record media"
                      className="w-full rounded-md object-cover"
                    />
                  )
                )}
              </div>
            </div>
          ) : null}
          <Separator />
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            onClick={handleDelete}
          >
            삭제
          </Button>
        </div>
      </main>
    </MobileContainer>
  );
}

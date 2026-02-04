"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import MoodSelector from "@/components/records/MoodSelector";
import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabaseClient";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const BUCKET = "record-media";

type FormState = {
  record_date: string;
  start_time: string;
  end_time: string;
  content: string;
  mood: number | null;
  location: string;
  level: string;
  instructor: string;
  class_review: string;
  bar_order: string;
  center_order: string;
  new_learned: string;
  feedback: string;
  did_well: string;
  improve_next: string;
};

export default function RecordEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<FormState>({
    record_date: "",
    start_time: "",
    end_time: "",
    content: "",
    mood: null,
    location: "",
    level: "",
    instructor: "",
    class_review: "",
    bar_order: "",
    center_order: "",
    new_learned: "",
    feedback: "",
    did_well: "",
    improve_next: "",
  });

  useEffect(() => {
    const fetchRecord = async () => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data } = await supabase
        .from("records")
        .select(
          "record_date,start_time,end_time,content,mood,location,level,instructor,class_review,bar_order,center_order,new_learned,feedback,did_well,improve_next"
        )
        .eq("id", params.id)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .single();

      if (data) {
        setForm({
          record_date: data.record_date,
          start_time: data.start_time,
          end_time: data.end_time,
          content: data.content,
          mood: data.mood,
          location: data.location ?? "",
          level: data.level ?? "",
          instructor: data.instructor ?? "",
          class_review: data.class_review ?? "",
          bar_order: data.bar_order ?? "",
          center_order: data.center_order ?? "",
          new_learned: data.new_learned ?? "",
          feedback: data.feedback ?? "",
          did_well: data.did_well ?? "",
          improve_next: data.improve_next ?? "",
        });
      }
      setLoading(false);
    };

    fetchRecord();
  }, [params.id, user, router]);

  const handleSubmit = async () => {
    setError(null);
    if (!user) return;

    if (!form.record_date || !form.start_time || !form.end_time || !form.content) {
      setError("필수 항목을 모두 입력해 주세요.");
      return;
    }
    if (form.end_time < form.start_time) {
      setError("종료 시간이 시작 시간보다 빠를 수 없습니다.");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase
      .from("records")
      .update({
        ...form,
      })
      .eq("id", params.id)
      .eq("user_id", user.id);

    if (updateError) {
      setSaving(false);
      setError("기록 수정에 실패했습니다.");
      return;
    }

    const uploads: Array<{
      path: string;
      media_type: "image" | "video";
      file: File;
    }> = [];

    images.slice(0, 3).forEach((file) => {
      uploads.push({
        file,
        media_type: "image",
        path: `${user.id}/${params.id}/${Date.now()}-${file.name}`,
      });
    });
    if (video) {
      uploads.push({
        file: video,
        media_type: "video",
        path: `${user.id}/${params.id}/${Date.now()}-${video.name}`,
      });
    }

    for (const upload of uploads) {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(upload.path, upload.file);

      if (uploadError) {
        continue;
      }

      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(upload.path);

      await supabase.from("record_media").insert({
        record_id: params.id,
        user_id: user.id,
        media_type: upload.media_type,
        url: urlData.publicUrl,
      });
    }

    router.replace(`/record/${params.id}`);
  };

  if (loading) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-[#17171c]/70">기록을 불러오는 중...</p>
        </main>
      </MobileContainer>
    );
  }

  return (
    <MobileContainer>
      <main className="px-4 pb-10 pt-6">
        <header className="mb-6 flex items-center justify-between">
          <button
            type="button"
            className="text-sm text-[#17171c]/70"
            onClick={() => router.back()}
          >
            뒤로
          </button>
          <h1 className="text-base font-semibold">기록 수정</h1>
          <div className="w-10" />
        </header>

        <div className="space-y-4">
          <label className="block text-sm">
            날짜
            <input
              type="date"
              className="mt-2 w-full rounded-md border border-black/10 p-2"
              value={form.record_date}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, record_date: event.target.value }))
              }
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              시작 시간
              <input
                type="time"
                className="mt-2 w-full rounded-md border border-black/10 p-2"
                value={form.start_time}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, start_time: event.target.value }))
                }
              />
            </label>
            <label className="block text-sm">
              종료 시간
              <input
                type="time"
                className="mt-2 w-full rounded-md border border-black/10 p-2"
                value={form.end_time}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, end_time: event.target.value }))
                }
              />
            </label>
          </div>
          <label className="block text-sm">
            기록 내용
            <textarea
              className="mt-2 w-full rounded-md border border-black/10 p-2"
              rows={4}
              value={form.content}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, content: event.target.value }))
              }
            />
          </label>
          <div>
            <p className="text-sm">감정 상태</p>
            <div className="mt-2">
              <MoodSelector
                value={form.mood}
                onChange={(next) => setForm((prev) => ({ ...prev, mood: next }))}
              />
            </div>
          </div>
          <label className="block text-sm">
            장소
            <input
              type="text"
              className="mt-2 w-full rounded-md border border-black/10 p-2"
              value={form.location}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, location: event.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            레벨
            <input
              type="text"
              className="mt-2 w-full rounded-md border border-black/10 p-2"
              value={form.level}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, level: event.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            강사
            <input
              type="text"
              className="mt-2 w-full rounded-md border border-black/10 p-2"
              value={form.instructor}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  instructor: event.target.value,
                }))
              }
            />
          </label>
          <label className="block text-sm">
            오늘 수업 어땠는지?
            <textarea
              className="mt-2 w-full rounded-md border border-black/10 p-2"
              rows={3}
              value={form.class_review}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  class_review: event.target.value,
                }))
              }
            />
          </label>
          <label className="block text-sm">
            바(bar) 순서
            <input
              type="text"
              className="mt-2 w-full rounded-md border border-black/10 p-2"
              value={form.bar_order}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, bar_order: event.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            센터(center) 순서
            <input
              type="text"
              className="mt-2 w-full rounded-md border border-black/10 p-2"
              value={form.center_order}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  center_order: event.target.value,
                }))
              }
            />
          </label>
          <label className="block text-sm">
            오늘 새롭게 배운 것
            <textarea
              className="mt-2 w-full rounded-md border border-black/10 p-2"
              rows={3}
              value={form.new_learned}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  new_learned: event.target.value,
                }))
              }
            />
          </label>
          <label className="block text-sm">
            수업에서 받은 피드백
            <textarea
              className="mt-2 w-full rounded-md border border-black/10 p-2"
              rows={3}
              value={form.feedback}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, feedback: event.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            오늘 잘한 것
            <textarea
              className="mt-2 w-full rounded-md border border-black/10 p-2"
              rows={3}
              value={form.did_well}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, did_well: event.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            다음에 더 신경 써야 하는 것
            <textarea
              className="mt-2 w-full rounded-md border border-black/10 p-2"
              rows={3}
              value={form.improve_next}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  improve_next: event.target.value,
                }))
              }
            />
          </label>
          <div className="space-y-2">
            <label className="block text-sm">
              사진 업로드 (최대 3장)
              <input
                type="file"
                accept="image/*"
                multiple
                className="mt-2 w-full text-sm"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  const filtered = files.filter((file) => file.size <= MAX_IMAGE_SIZE);
                  setImages(filtered.slice(0, 3));
                }}
              />
            </label>
            <label className="block text-sm">
              영상 업로드 (최대 1개)
              <input
                type="file"
                accept="video/*"
                className="mt-2 w-full text-sm"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file && file.size <= MAX_VIDEO_SIZE) {
                    setVideo(file);
                  } else {
                    setVideo(null);
                  }
                }}
              />
            </label>
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <button
            type="button"
            className="w-full rounded-md bg-[#17171c] py-3 text-sm font-semibold text-white"
            disabled={saving}
            onClick={handleSubmit}
          >
            {saving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </main>
    </MobileContainer>
  );
}

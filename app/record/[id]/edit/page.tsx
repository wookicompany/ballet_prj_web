"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { format } from "date-fns";
import MoodSelector from "@/components/records/MoodSelector";
import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseClient";
import { CalendarDays, ChevronLeft, Plus } from "lucide-react";
import BottomSheet from "@/components/sheets/BottomSheet";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
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
  bar_order: string;
  center_order: string;
  did_well: string;
  improve_next: string;
};

export default function RecordEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOrders, setShowOrders] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [startSheetOpen, setStartSheetOpen] = useState(false);
  const [endSheetOpen, setEndSheetOpen] = useState(false);
  const [startDraft, setStartDraft] = useState({ hour: "00", minute: "00" });
  const [endDraft, setEndDraft] = useState({ hour: "00", minute: "00" });
  const [dateDraft, setDateDraft] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
  });
  const hours = useMemo(
    () => Array.from({ length: 24 }, (_, idx) => String(idx).padStart(2, "0")),
    []
  );
  const minutes = useMemo(
    () => Array.from({ length: 60 }, (_, idx) => String(idx).padStart(2, "0")),
    []
  );
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, idx) => currentYear - 2 + idx);
  }, []);
  const months = useMemo(() => Array.from({ length: 12 }, (_, idx) => idx + 1), []);

  const [form, setForm] = useState<FormState>({
    record_date: "",
    start_time: "",
    end_time: "",
    content: "",
    mood: null,
    location: "",
    level: "",
    instructor: "",
    bar_order: "",
    center_order: "",
    did_well: "",
    improve_next: "",
  });

  useEffect(() => {
    const fetchRecord = async () => {
      if (!user) {
        openLoginSheet();
        return;
      }

      const { data } = await supabase
        .from("records")
        .select(
          "record_date,start_time,end_time,content,mood,location,level,instructor,bar_order,center_order,did_well,improve_next"
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
          bar_order: data.bar_order ?? "",
          center_order: data.center_order ?? "",
          did_well: data.did_well ?? "",
          improve_next: data.improve_next ?? "",
        });
        setShowOrders(!!(data.bar_order || data.center_order));
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

  const mediaItems = useMemo(() => {
    const items: Array<{
      type: "image";
      url: string;
      file: File;
    }> = [];
    images.forEach((file) => {
      items.push({
        type: "image",
        url: URL.createObjectURL(file),
        file,
      });
    });
    return items.slice(0, 3);
  }, [images]);

  useEffect(() => {
    return () => {
      mediaItems.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [mediaItems]);

  const handleMediaSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      if (file.size > MAX_IMAGE_SIZE || images.length >= 3) {
        return;
      }
      setImages((prev) => [...prev, file].slice(0, 3));
    }

    event.target.value = "";
  };

  const startHour = form.start_time ? form.start_time.split(":")[0] : "00";
  const startMinute = form.start_time ? form.start_time.split(":")[1] : "00";
  const endHour = form.end_time ? form.end_time.split(":")[0] : "00";
  const endMinute = form.end_time ? form.end_time.split(":")[1] : "00";

  if (!user) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-sm text-[#17171c]/70">
            로그인하면 기록을 수정할 수 있어요.
          </p>
          <Button type="button" onClick={openLoginSheet}>
            로그인할게요
          </Button>
        </main>
      </MobileContainer>
    );
  }

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
      <main className="px-4 pb-12 pt-6">
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
          <h1 className="text-base font-semibold">기록 수정</h1>
          <div className="w-9" />
        </header>

        <div className="space-y-6">
          <section className="space-y-3">
            <Label className="text-xs text-[#17171c]/60">미디어 업로드</Label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                className="relative aspect-square rounded-lg border border-dashed border-black/10 bg-transparent"
                onClick={() => fileInputRef.current?.click()}
                aria-label="사진 추가"
              >
                <Plus className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-[#17171c]/40" />
              </button>
              {mediaItems.map((item, index) => (
                <div
                  key={`image-${index}`}
                  className="relative aspect-square overflow-hidden rounded-lg border border-black/10 bg-black/5"
                >
                  <img
                    src={item.url}
                    alt="업로드 사진"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-1 top-1 rounded-full bg-white/80 px-1.5 text-[10px] text-[#17171c]">
                    사진
                  </span>
                </div>
              ))}
            </div>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleMediaSelect}
            />
            <p className="text-[11px] text-[#17171c]/50">
              사진은 최대 3장까지 업로드할 수 있어요.
            </p>
          </section>

          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <Separator />

          <section className="space-y-4">
            <div>
              <Label className="text-xs text-[#17171c]/60">감정 상태</Label>
              <div className="mt-2">
                <MoodSelector
                  value={form.mood}
                  onChange={(next) =>
                    setForm((prev) => ({ ...prev, mood: next }))
                  }
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-[#17171c]/60">날짜</Label>
              <Button
                type="button"
                variant="outline"
                className="mt-2 w-full justify-start gap-2 text-left font-normal"
                onClick={() => {
                  const baseDate = form.record_date
                    ? new Date(form.record_date)
                    : new Date();
                  setDateDraft({
                    year: baseDate.getFullYear(),
                    month: baseDate.getMonth() + 1,
                    day: baseDate.getDate(),
                  });
                  setDateSheetOpen(true);
                }}
              >
                <CalendarDays className="h-4 w-4" />
                {form.record_date
                  ? format(new Date(form.record_date), "yyyy-MM-dd")
                  : "날짜 선택"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-[#17171c]/60">시작 시간</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 w-full justify-start text-left font-normal"
                  onClick={() => {
                    setStartDraft({ hour: startHour, minute: startMinute });
                    setStartSheetOpen(true);
                  }}
                >
                  {form.start_time ? `${startHour}:${startMinute}` : "시간 선택"}
                </Button>
              </div>
              <div>
                <Label className="text-xs text-[#17171c]/60">종료 시간</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 w-full justify-start text-left font-normal"
                  onClick={() => {
                    setEndDraft({ hour: endHour, minute: endMinute });
                    setEndSheetOpen(true);
                  }}
                >
                  {form.end_time ? `${endHour}:${endMinute}` : "시간 선택"}
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-[#17171c]/60">
                오늘 발레는 어땠나요?
              </Label>
              <Textarea
                className="mt-2 min-h-[120px]"
                value={form.content}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, content: event.target.value }))
                }
              />
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <div>
              <Label className="text-xs text-[#17171c]/60">장소</Label>
              <Input
                type="text"
                className="mt-2"
                value={form.location}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, location: event.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-[#17171c]/60">레벨</Label>
                <Input
                  type="text"
                  className="mt-2"
                  value={form.level}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, level: event.target.value }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs text-[#17171c]/60">강사</Label>
                <Input
                  type="text"
                  className="mt-2"
                  value={form.instructor}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      instructor: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-[#17171c]/60">오늘 잘한 것</Label>
              <Textarea
                className="mt-2"
                rows={3}
                value={form.did_well}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, did_well: event.target.value }))
                }
              />
            </div>
            <div>
              <Label className="text-xs text-[#17171c]/60">
                다음에 더 신경 써야 하는 것
              </Label>
              <Textarea
                className="mt-2"
                rows={3}
                value={form.improve_next}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    improve_next: event.target.value,
                  }))
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="order-options"
                checked={showOrders}
                onCheckedChange={(checked) => setShowOrders(!!checked)}
              />
              <Label
                htmlFor="order-options"
                className="text-xs text-[#17171c]/70"
              >
                바/센터 순서 입력
              </Label>
            </div>
            {showOrders ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-[#17171c]/60">바(bar) 순서</Label>
                  <Input
                    type="text"
                    className="mt-2"
                    value={form.bar_order}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        bar_order: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs text-[#17171c]/60">
                    센터(center) 순서
                  </Label>
                  <Input
                    type="text"
                    className="mt-2"
                    value={form.center_order}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        center_order: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            ) : null}
          </section>

          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <Button
            type="button"
            className="w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
            disabled={saving}
            onClick={handleSubmit}
          >
            {saving ? "저장 중..." : "저장하기"}
          </Button>
        </div>
        <BottomSheet
          open={dateSheetOpen}
          onOpenChange={setDateSheetOpen}
          title="날짜를 선택해 주세요"
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-black/5 p-2">
              {years.map((year) => (
                <Button
                  key={`year-${year}`}
                  type="button"
                  variant={dateDraft.year === year ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setDateDraft((prev) => ({ ...prev, year }))}
                >
                  {year}년
                </Button>
              ))}
            </div>
            <div className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-black/5 p-2">
              {months.map((month) => (
                <Button
                  key={`month-${month}`}
                  type="button"
                  variant={dateDraft.month === month ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setDateDraft((prev) => ({ ...prev, month }))}
                >
                  {String(month).padStart(2, "0")}월
                </Button>
              ))}
            </div>
            <div className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-black/5 p-2">
              {Array.from(
                { length: new Date(dateDraft.year, dateDraft.month, 0).getDate() },
                (_, idx) => idx + 1
              ).map((day) => (
                <Button
                  key={`day-${day}`}
                  type="button"
                  variant={dateDraft.day === day ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setDateDraft((prev) => ({ ...prev, day }))}
                >
                  {String(day).padStart(2, "0")}일
                </Button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <Button
              className="w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
              onClick={() => {
                const paddedMonth = String(dateDraft.month).padStart(2, "0");
                const paddedDay = String(dateDraft.day).padStart(2, "0");
                setForm((prev) => ({
                  ...prev,
                  record_date: `${dateDraft.year}-${paddedMonth}-${paddedDay}`,
                }));
                setDateSheetOpen(false);
              }}
            >
              적용할게요
            </Button>
          </div>
        </BottomSheet>

        <BottomSheet
          open={startSheetOpen}
          onOpenChange={setStartSheetOpen}
          title="시작 시간을 선택해 주세요"
        >
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-black/5 p-2">
              {hours.map((hour) => (
                <Button
                  key={`start-drawer-hour-${hour}`}
                  type="button"
                  variant={startDraft.hour === hour ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setStartDraft((prev) => ({ ...prev, hour }))}
                >
                  {hour}시
                </Button>
              ))}
            </div>
            <div className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-black/5 p-2">
              {minutes.map((minute) => (
                <Button
                  key={`start-drawer-min-${minute}`}
                  type="button"
                  variant={startDraft.minute === minute ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setStartDraft((prev) => ({ ...prev, minute }))}
                >
                  {minute}분
                </Button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <Button
              className="w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
              onClick={() => {
                setForm((prev) => ({
                  ...prev,
                  start_time: `${startDraft.hour}:${startDraft.minute}`,
                }));
                setStartSheetOpen(false);
              }}
            >
              적용할게요
            </Button>
          </div>
        </BottomSheet>

        <BottomSheet
          open={endSheetOpen}
          onOpenChange={setEndSheetOpen}
          title="종료 시간을 선택해 주세요"
        >
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-black/5 p-2">
              {hours.map((hour) => (
                <Button
                  key={`end-drawer-hour-${hour}`}
                  type="button"
                  variant={endDraft.hour === hour ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setEndDraft((prev) => ({ ...prev, hour }))}
                >
                  {hour}시
                </Button>
              ))}
            </div>
            <div className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-black/5 p-2">
              {minutes.map((minute) => (
                <Button
                  key={`end-drawer-min-${minute}`}
                  type="button"
                  variant={endDraft.minute === minute ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setEndDraft((prev) => ({ ...prev, minute }))}
                >
                  {minute}분
                </Button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <Button
              className="w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
              onClick={() => {
                setForm((prev) => ({
                  ...prev,
                  end_time: `${endDraft.hour}:${endDraft.minute}`,
                }));
                setEndSheetOpen(false);
              }}
            >
              적용할게요
            </Button>
          </div>
        </BottomSheet>
      </main>
    </MobileContainer>
  );
}

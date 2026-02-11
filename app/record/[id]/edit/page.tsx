"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { format } from "date-fns";
import { ko } from "date-fns/locale";
import MoodSelector from "@/components/records/MoodSelector";
import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { ensureSessionOrLogin } from "@/lib/authSession";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseClient";
import { CalendarDays, ChevronLeft, Plus, X } from "lucide-react";
import BottomSheet from "@/components/sheets/BottomSheet";
import { toast } from "sonner";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const BUCKET = "record-media";
const ORDER_TAGS = [
  "그랑 바뜨망",
  "롱드잠 아떼르",
  "롱드잠 앙레르",
  "아다지오",
  "제떼",
  "탄듀",
  "프라페",
  "플리에",
  "퐁듀",
];

const LOCATION_DELIMITER = " | ";
const ADDRESS_DELIMITER = " || ";

const buildLocationValue = (
  name: string,
  base: string,
  detail: string
) => {
  const trimmedName = name.trim();
  const trimmedBase = base.trim();
  const trimmedDetail = detail.trim();
  if (!trimmedName && !trimmedBase && !trimmedDetail) return "";

  const normalizedBase =
    trimmedDetail && trimmedBase.endsWith(trimmedDetail)
      ? trimmedBase.slice(0, -trimmedDetail.length).trim()
      : trimmedBase;
  const shouldAppendDetail =
    trimmedDetail && normalizedBase && !normalizedBase.includes(trimmedDetail);
  const address = normalizedBase
    ? shouldAppendDetail
      ? `${normalizedBase}${ADDRESS_DELIMITER}${trimmedDetail}`
      : normalizedBase
    : trimmedDetail
      ? `${ADDRESS_DELIMITER}${trimmedDetail}`
      : "";

  if (!trimmedName) return address;
  if (!address) return trimmedName;
  return `${trimmedName}${LOCATION_DELIMITER}${address}`;
};

const parseLocationValue = (value: string) => {
  if (!value) {
    return { name: "", base: "", detail: "" };
  }
  if (value.includes(LOCATION_DELIMITER)) {
    const [name, ...rest] = value.split(LOCATION_DELIMITER);
    const address = rest.join(LOCATION_DELIMITER).trim();
    if (address.includes(ADDRESS_DELIMITER)) {
      const [base, ...detailParts] = address.split(ADDRESS_DELIMITER);
      return {
        name: name.trim(),
        base: base.trim(),
        detail: detailParts.join(ADDRESS_DELIMITER).trim(),
      };
    }
    return { name: name.trim(), base: address, detail: "" };
  }
  if (value.includes(ADDRESS_DELIMITER)) {
    const [base, ...detailParts] = value.split(ADDRESS_DELIMITER);
    return {
      name: "",
      base: base.trim(),
      detail: detailParts.join(ADDRESS_DELIMITER).trim(),
    };
  }
  return { name: "", base: value.trim(), detail: "" };
};

const getSafeFileName = (file: File) => {
  const fallbackExt = file.type?.split("/")[1] || "jpg";
  const match = file.name.match(/\.([a-zA-Z0-9]+)$/);
  const ext = match ? match[1].toLowerCase() : fallbackExt;
  const seed = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${seed}.${ext}`;
};

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
  const { user, loading: authLoading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [recordLoading, setRecordLoading] = useState(true);
  const [showBarOrder, setShowBarOrder] = useState(false);
  const [showCenterOrder, setShowCenterOrder] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showLevelInstructor, setShowLevelInstructor] = useState(false);
  const [barOrderTags, setBarOrderTags] = useState<string[]>([]);
  const [centerOrderTags, setCenterOrderTags] = useState<string[]>([]);
  const [existingMedia, setExistingMedia] = useState<
    Array<{ id: string; url: string }>
  >([]);
  const [removedMediaIds, setRemovedMediaIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [startSheetOpen, setStartSheetOpen] = useState(false);
  const [endSheetOpen, setEndSheetOpen] = useState(false);
  const yearListRef = useRef<HTMLDivElement>(null);
  const monthListRef = useRef<HTMLDivElement>(null);
  const dayListRef = useRef<HTMLDivElement>(null);
  const startHourListRef = useRef<HTMLDivElement>(null);
  const startMinuteListRef = useRef<HTMLDivElement>(null);
  const endHourListRef = useRef<HTMLDivElement>(null);
  const endMinuteListRef = useRef<HTMLDivElement>(null);
  const [startDraft, setStartDraft] = useState({ hour: "00", minute: "00" });
  const [endDraft, setEndDraft] = useState({ hour: "00", minute: "00" });
  const [dateDraft, setDateDraft] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
  });
  const [locationName, setLocationName] = useState("");
  const [locationBase, setLocationBase] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
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

  useEffect(() => {
    if (!dateSheetOpen) return;

    const scrollToCenter = (container: HTMLDivElement | null, value: string) => {
      if (!container) return;
      const target = container.querySelector<HTMLButtonElement>(
        `button[data-value="${value}"]`
      );
      if (!target) return;
      target.scrollIntoView({ block: "center", inline: "center" });
    };

    const frame = requestAnimationFrame(() => {
      scrollToCenter(yearListRef.current, String(dateDraft.year));
      scrollToCenter(monthListRef.current, String(dateDraft.month).padStart(2, "0"));
      scrollToCenter(dayListRef.current, String(dateDraft.day).padStart(2, "0"));
    });

    return () => cancelAnimationFrame(frame);
  }, [dateSheetOpen, dateDraft.year, dateDraft.month, dateDraft.day]);

  useEffect(() => {
    if (!startSheetOpen) return;
    requestAnimationFrame(() => {
      const hourTarget = startHourListRef.current?.querySelector(
        `[data-value="${startDraft.hour}"]`
      );
      const minuteTarget = startMinuteListRef.current?.querySelector(
        `[data-value="${startDraft.minute}"]`
      );
      hourTarget?.scrollIntoView({ block: "center" });
      minuteTarget?.scrollIntoView({ block: "center" });
    });
  }, [startSheetOpen, startDraft]);

  useEffect(() => {
    if (!endSheetOpen) return;
    requestAnimationFrame(() => {
      const hourTarget = endHourListRef.current?.querySelector(
        `[data-value="${endDraft.hour}"]`
      );
      const minuteTarget = endMinuteListRef.current?.querySelector(
        `[data-value="${endDraft.minute}"]`
      );
      hourTarget?.scrollIntoView({ block: "center" });
      minuteTarget?.scrollIntoView({ block: "center" });
    });
  }, [endSheetOpen, endDraft]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (document.getElementById("kakao-postcode-script")) return;
    const script = document.createElement("script");
    script.id = "kakao-postcode-script";
    script.src =
      "//t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const handleSearchAddress = () => {
    if (typeof window === "undefined") return;
    const kakao = (window as typeof window & { kakao?: any }).kakao;
    if (!kakao?.Postcode) {
      toast("주소 검색을 불러오는 중이에요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    new kakao.Postcode({
      oncomplete: (data: { roadAddress?: string; jibunAddress?: string }) => {
        const address = data.roadAddress || data.jibunAddress || "";
        if (!address) return;
        if (address !== locationBase) {
          setLocationBase(address);
          if (locationDetail) {
            setLocationDetail("");
          }
          return;
        }
        setLocationBase(address);
      },
    }).open();
  };

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
      if (authLoading) return;
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
        const barTags = data.bar_order
          ? data.bar_order.split(",").map((value) => value.trim()).filter(Boolean)
          : [];
        const centerTags = data.center_order
          ? data.center_order
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean)
          : [];
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
        setBarOrderTags(barTags);
        setCenterOrderTags(centerTags);
        setShowBarOrder(barTags.length > 0);
        setShowCenterOrder(centerTags.length > 0);
        setShowLocation(Boolean(data.location));
        setShowLevelInstructor(Boolean(data.level || data.instructor));
        const parsedLocation = parseLocationValue(data.location ?? "");
        setLocationName(parsedLocation.name);
        setLocationBase(parsedLocation.base);
        setLocationDetail(parsedLocation.detail);
      }

      const { data: mediaData } = await supabase
        .from("record_media")
        .select("id,url")
        .eq("record_id", params.id)
        .eq("user_id", user.id)
        .order("created_at");

      setExistingMedia(
        (mediaData as Array<{ id: string; url: string }>) ?? []
      );
      setRemovedMediaIds([]);
      setRecordLoading(false);
    };

    fetchRecord();
  }, [params.id, user, router, authLoading, openLoginSheet]);

  const handleSubmit = async () => {
    if (!user || authLoading) return;

    if (!form.record_date || !form.start_time || !form.end_time || !form.mood) {
      toast("날짜, 시작 시간, 종료 시간, 오늘 발레는 어땠나요?는 필수예요.");
      return;
    }
    if (form.end_time < form.start_time) {
      toast("종료 시간이 시작 시간보다 빠를 수 없습니다.");
      return;
    }

    const resolvedLocation = showLocation
      ? buildLocationValue(locationName, locationBase, locationDetail)
      : "";

    setSaving(true);
    const session = await ensureSessionOrLogin(openLoginSheet);
    if (!session) {
      setSaving(false);
      return;
    }
    const response = await fetch(`/api/records/${params.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...form,
        location: resolvedLocation,
        level: showLevelInstructor ? form.level : "",
        instructor: showLevelInstructor ? form.instructor : "",
        bar_order: showBarOrder ? barOrderTags.join(", ") : "",
        center_order: showCenterOrder ? centerOrderTags.join(", ") : "",
      }),
    });

    if (!response.ok) {
      setSaving(false);
      toast("기록 수정에 실패했습니다.");
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
        path: `${user.id}/${params.id}/${getSafeFileName(file)}`,
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
      await fetch(`/api/records/${params.id}/media`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              media_type: upload.media_type,
              url: urlData.publicUrl,
            },
          ],
        }),
      });
    }

    if (removedMediaIds.length > 0) {
      const deleteResponse = await fetch(`/api/records/${params.id}/media`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mediaIds: removedMediaIds }),
      });
      if (!deleteResponse.ok) {
        toast("미디어 삭제에 실패했습니다.");
        setSaving(false);
        return;
      }
    }

    router.replace(`/record/${params.id}`);
  };

  const mediaItems = useMemo(() => {
    const items: Array<
      | { type: "existing"; id: string; url: string }
      | { type: "new"; url: string; file: File }
    > = [];

    existingMedia.forEach((item) => {
      if (removedMediaIds.includes(item.id)) return;
      items.push({ type: "existing", id: item.id, url: item.url });
    });
    images.forEach((file) => {
      items.push({
        type: "new",
        url: URL.createObjectURL(file),
        file,
      });
    });

    return items.slice(0, 3);
  }, [existingMedia, images, removedMediaIds]);

  useEffect(() => {
    return () => {
      mediaItems.forEach((item) => {
        if (item.type === "new") {
          URL.revokeObjectURL(item.url);
        }
      });
    };
  }, [mediaItems]);

  const handleMediaSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      const visibleExisting = existingMedia.filter(
        (item) => !removedMediaIds.includes(item.id)
      );
      if (
        file.size > MAX_IMAGE_SIZE ||
        visibleExisting.length + images.length >= 3
      ) {
        return;
      }
      setImages((prev) => [...prev, file].slice(0, 3));
    }

    event.target.value = "";
  };

  const handleRemoveImage = (
    index: number,
    item: { type: "existing"; id: string } | { type: "new" }
  ) => {
    if (item.type === "existing") {
      setRemovedMediaIds((prev) =>
        prev.includes(item.id) ? prev : [...prev, item.id]
      );
      return;
    }
    const newIndex = index - existingMedia.filter(
      (media) => !removedMediaIds.includes(media.id)
    ).length;
    setImages((prev) => prev.filter((_, idx) => idx !== newIndex));
  };

  const startHour = form.start_time ? form.start_time.split(":")[0] : "00";
  const startMinute = form.start_time ? form.start_time.split(":")[1] : "00";
  const endHour = form.end_time ? form.end_time.split(":")[0] : "00";
  const endMinute = form.end_time ? form.end_time.split(":")[1] : "00";
  const formatMeridiem = (hour: string) =>
    Number(hour) < 12 ? "오전" : "오후";
  const formatHour12 = (hour: string) => {
    const value = Number(hour);
    const normalized = value % 12 === 0 ? 12 : value % 12;
    return String(normalized).padStart(2, "0");
  };
  const formatTimeDisplay = (hour: string, minute: string) =>
    `${formatMeridiem(hour)} ${formatHour12(hour)}시 ${minute}분`;
  const getClampedNowTime = () => {
    const now = new Date();
    const hourValue = Math.max(now.getHours(), 6);
    const minuteValue = now.getMinutes();
    return {
      hour: String(hourValue).padStart(2, "0"),
      minute: String(minuteValue).padStart(2, "0"),
    };
  };

  if (authLoading) {
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
        <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-sm text-[#17171c]/70">
            로그인하면 기록을 수정할 수 있어요.
          </p>
        </main>
      </MobileContainer>
    );
  }

  if (recordLoading) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen items-center justify-center">
          <Spinner size="lg" />
        </main>
      </MobileContainer>
    );
  }

  return (
    <MobileContainer>
      {saving ? <LoadingOverlay /> : null}
      <main className="px-4 pb-12 pt-6">
        <header className="mb-6 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="text-[#17171c]/70"
            onClick={() => router.back()}
            aria-label="뒤로"
          >
            <ChevronLeft className="size-6" />
          </Button>
          <h1 className="text-base font-semibold">기록 수정</h1>
          <div className="w-9" />
        </header>

        <div className="space-y-8">
          <section className="space-y-3">
            <Label className="text-xs text-[#17171c]/60">미디어 업로드</Label>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 pr-2">
              <button
                type="button"
                className="relative aspect-square w-20 shrink-0 rounded-lg border border-dashed border-black/10 bg-transparent"
                onClick={() => fileInputRef.current?.click()}
                aria-label="사진 추가"
              >
                <Plus className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-[#17171c]/40" />
              </button>
              {mediaItems.map((item, index) => (
                <div
                  key={`image-${item.type === "existing" ? item.id : index}`}
                  className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-lg bg-white"
                >
                  <img
                    src={item.url}
                    alt="업로드 사진"
                    className="h-full w-full object-contain"
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-[#17171c] shadow-sm"
                    onClick={() =>
                      handleRemoveImage(
                        index,
                        item.type === "existing"
                          ? { type: "existing", id: item.id }
                          : { type: "new" }
                      )
                    }
                    aria-label="업로드 사진 삭제"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
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

          <Separator />

          <section className="space-y-4">
            <div className="pt-0">
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
                  ? format(new Date(form.record_date), "yyyy년 MM월 dd일(EEE)", {
                      locale: ko,
                    })
                  : "날짜 선택"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <Label className="text-xs text-[#17171c]/60">시작 시간</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 w-full justify-start text-left font-normal"
                  onClick={() => {
                    const nextDraft = form.start_time
                      ? { hour: startHour, minute: startMinute }
                      : getClampedNowTime();
                    setStartDraft(nextDraft);
                    setStartSheetOpen(true);
                  }}
                >
                  {form.start_time
                    ? formatTimeDisplay(startHour, startMinute)
                    : "시간 선택"}
                </Button>
              </div>
              <div>
                <Label className="text-xs text-[#17171c]/60">종료 시간</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 w-full justify-start text-left font-normal"
                  onClick={() => {
                    const nextDraft = form.end_time
                      ? { hour: endHour, minute: endMinute }
                      : getClampedNowTime();
                    setEndDraft(nextDraft);
                    setEndSheetOpen(true);
                  }}
                >
                  {form.end_time
                    ? formatTimeDisplay(endHour, endMinute)
                    : "시간 선택"}
                </Button>
              </div>
            </div>
            <div className="pt-2">
              <Label className="text-xs text-[#17171c]/60">
                오늘 발레는 어땠나요?
              </Label>
              <div className="mt-2">
                <MoodSelector
                  value={form.mood}
                  onChange={(next) =>
                    setForm((prev) => ({ ...prev, mood: next }))
                  }
                />
              </div>
            </div>
            <div className="pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-[#17171c]/60">
                  오늘의 발레를 한줄로 남겨보아요.
                </Label>
                <span className="text-[11px] text-[#17171c]/50">
                  {form.content.length}/16
                </span>
              </div>
              <Input
                className="mt-2 text-sm"
                maxLength={16}
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
              <Label className="text-xs text-[#17171c]/60">
                오늘 잘했던 점을 남겨볼까요?
              </Label>
              <Textarea
                className="mt-2 text-sm"
                rows={3}
                value={form.did_well}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, did_well: event.target.value }))
                }
              />
            </div>
            <div>
              <Label className="text-xs text-[#17171c]/60">
                다음에는 무엇을 조금 더 신경 쓰면 좋을까요?
              </Label>
              <Textarea
                className="mt-2 text-sm"
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
                id="bar-order-options"
                checked={showBarOrder}
                onCheckedChange={(checked) => {
                  const next = !!checked;
                  setShowBarOrder(next);
                  if (!next) {
                    setBarOrderTags([]);
                  }
                }}
              />
              <Label
                htmlFor="bar-order-options"
                className="text-xs text-[#17171c]/70"
              >
                바 순서 입력
              </Label>
            </div>
            {showBarOrder ? (
              <div className="space-y-3">
                <Label className="text-xs text-[#17171c]/60">바(bar) 순서</Label>
                <div className="space-y-2 rounded-lg border border-black/10 bg-white p-2 min-h-[44px]">
                  {barOrderTags.length === 0 ? (
                    <p className="text-[11px] text-[#17171c]/40">
                      선택된 순서가 여기 표시돼요.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {barOrderTags.map((tag, index) => (
                        <div
                          key={`bar-selected-${tag}-${index}`}
                          className="flex items-center gap-2"
                        >
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 rounded-full px-2 text-xs"
                            onClick={() =>
                              setBarOrderTags((prev) =>
                                prev.filter((_, idx) => idx !== index)
                              )
                            }
                          >
                            {tag}
                          </Button>
                          {index < barOrderTags.length - 1 ? (
                            <span className="text-xs text-[#17171c]/40">&gt;</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {ORDER_TAGS.map((tag) => {
                    const selected = barOrderTags.includes(tag);
                    return (
                      <Button
                        key={`bar-tag-${tag}`}
                        type="button"
                        variant={selected ? "default" : "outline"}
                        size="sm"
                        className="h-7 rounded-full px-3 text-xs"
                        onClick={() =>
                          setBarOrderTags((prev) =>
                            selected
                              ? prev.filter((value) => value !== tag)
                              : [...prev, tag]
                          )
                        }
                      >
                        {tag}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Checkbox
                id="center-order-options"
                checked={showCenterOrder}
                onCheckedChange={(checked) => {
                  const next = !!checked;
                  setShowCenterOrder(next);
                  if (!next) {
                    setCenterOrderTags([]);
                  }
                }}
              />
              <Label
                htmlFor="center-order-options"
                className="text-xs text-[#17171c]/70"
              >
                센터 순서 입력
              </Label>
            </div>
            {showCenterOrder ? (
              <div className="space-y-3">
                <Label className="text-xs text-[#17171c]/60">
                  센터(center) 순서
                </Label>
                <div className="space-y-2 rounded-lg border border-black/10 bg-white p-2 min-h-[44px]">
                  {centerOrderTags.length === 0 ? (
                    <p className="text-[11px] text-[#17171c]/40">
                      선택된 순서가 여기 표시돼요.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {centerOrderTags.map((tag, index) => (
                        <div
                          key={`center-selected-${tag}-${index}`}
                          className="flex items-center gap-2"
                        >
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 rounded-full px-2 text-xs"
                            onClick={() =>
                              setCenterOrderTags((prev) =>
                                prev.filter((_, idx) => idx !== index)
                              )
                            }
                          >
                            {tag}
                          </Button>
                          {index < centerOrderTags.length - 1 ? (
                            <span className="text-xs text-[#17171c]/40">&gt;</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {ORDER_TAGS.map((tag) => {
                    const selected = centerOrderTags.includes(tag);
                    return (
                      <Button
                        key={`center-tag-${tag}`}
                        type="button"
                        variant={selected ? "default" : "outline"}
                        size="sm"
                        className="h-7 rounded-full px-3 text-xs"
                        onClick={() =>
                          setCenterOrderTags((prev) =>
                            selected
                              ? prev.filter((value) => value !== tag)
                              : [...prev, tag]
                          )
                        }
                      >
                        {tag}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Checkbox
                id="location-options"
                checked={showLocation}
                onCheckedChange={(checked) => {
                  const next = !!checked;
                  setShowLocation(next);
                  if (!next) {
                    setLocationName("");
                    setLocationBase("");
                    setLocationDetail("");
                    setForm((prev) => ({ ...prev, location: "" }));
                  }
                }}
              />
              <Label
                htmlFor="location-options"
                className="text-xs text-[#17171c]/70"
              >
                장소 입력
              </Label>
            </div>
            {showLocation ? (
              <div className="space-y-2">
                <Label className="text-xs text-[#17171c]/60">장소</Label>
                <Input
                  type="text"
                  className="text-sm placeholder:text-xs"
                  placeholder="장소 이름을 입력해 주세요"
                  value={locationName}
                  onChange={(event) => setLocationName(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-left text-[11px] font-normal"
                  onClick={handleSearchAddress}
                >
                  {locationBase || "주소 검색하기"}
                </Button>
                <Input
                  type="text"
                  className="text-sm placeholder:text-xs"
                  placeholder="상세 주소를 입력해 주세요 (선택사항)"
                  value={locationDetail}
                  onChange={(event) => setLocationDetail(event.target.value)}
                />
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Checkbox
                id="level-instructor-options"
                checked={showLevelInstructor}
                onCheckedChange={(checked) => {
                  const next = !!checked;
                  setShowLevelInstructor(next);
                  if (!next) {
                    setForm((prev) => ({
                      ...prev,
                      level: "",
                      instructor: "",
                    }));
                  }
                }}
              />
              <Label
                htmlFor="level-instructor-options"
                className="text-xs text-[#17171c]/70"
              >
                강사 &amp; 레벨 입력
              </Label>
            </div>
            {showLevelInstructor ? (
              <div className="grid grid-cols-2 gap-3">
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
              </div>
            ) : null}
          </section>

          <Button
            type="button"
            className="h-12 w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
            disabled={saving}
            onClick={handleSubmit}
          >
            저장하기
          </Button>
        </div>
        <BottomSheet
          open={dateSheetOpen}
          onOpenChange={setDateSheetOpen}
          title="날짜를 선택해 주세요"
        >
          <div className="grid grid-cols-3 gap-3">
            <div
              ref={yearListRef}
              className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-black/5 p-2"
            >
              {years.map((year) => (
                <Button
                  key={`year-${year}`}
                  data-value={String(year)}
                  type="button"
                  variant={dateDraft.year === year ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setDateDraft((prev) => ({ ...prev, year }))}
                >
                  {year}년
                </Button>
              ))}
            </div>
            <div
              ref={monthListRef}
              className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-black/5 p-2"
            >
              {months.map((month) => {
                const value = String(month).padStart(2, "0");
                return (
                  <Button
                    key={`month-${month}`}
                    data-value={value}
                    type="button"
                    variant={dateDraft.month === month ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setDateDraft((prev) => ({ ...prev, month }))}
                  >
                    {value}월
                  </Button>
                );
              })}
            </div>
            <div
              ref={dayListRef}
              className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-black/5 p-2"
            >
              {Array.from(
                { length: new Date(dateDraft.year, dateDraft.month, 0).getDate() },
                (_, idx) => idx + 1
              ).map((day) => {
                const value = String(day).padStart(2, "0");
                return (
                  <Button
                    key={`day-${day}`}
                    data-value={value}
                    type="button"
                    variant={dateDraft.day === day ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setDateDraft((prev) => ({ ...prev, day }))}
                  >
                    {value}일
                  </Button>
                );
              })}
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
          <div className="mt-2 grid grid-cols-3 gap-3">
            <div className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-black/5 p-2">
              <div
                className={`flex h-10 items-center justify-center rounded-md text-sm ${
                  Number(startDraft.hour) < 12
                    ? "bg-[#17171c]/5 text-[#17171c]"
                    : "text-[#17171c]/40"
                }`}
              >
                오전
              </div>
              <div
                className={`flex h-10 items-center justify-center rounded-md text-sm ${
                  Number(startDraft.hour) >= 12
                    ? "bg-[#17171c]/5 text-[#17171c]"
                    : "text-[#17171c]/40"
                }`}
              >
                오후
              </div>
            </div>
            <div
              ref={startHourListRef}
              className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-black/5 p-2"
            >
              {hours.map((hour) => (
                <Button
                  key={`start-drawer-hour-${hour}`}
                  type="button"
                  variant={startDraft.hour === hour ? "default" : "ghost"}
                  className="w-full justify-start"
                  data-value={hour}
                  onClick={() => setStartDraft((prev) => ({ ...prev, hour }))}
                >
                  {formatHour12(hour)}시
                </Button>
              ))}
            </div>
            <div
              ref={startMinuteListRef}
              className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-black/5 p-2"
            >
              {minutes.map((minute) => (
                <Button
                  key={`start-drawer-min-${minute}`}
                  type="button"
                  variant={startDraft.minute === minute ? "default" : "ghost"}
                  className="w-full justify-start"
                  data-value={minute}
                  onClick={() => setStartDraft((prev) => ({ ...prev, minute }))}
                >
                  {minute}분
                </Button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <Button
              className="h-12 w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
              onClick={() => {
                setForm((prev) => ({
                  ...prev,
                  start_time: `${startDraft.hour}:${startDraft.minute}`,
                }));
                setStartSheetOpen(false);
              }}
            >
              적용하기
            </Button>
          </div>
        </BottomSheet>

        <BottomSheet
          open={endSheetOpen}
          onOpenChange={setEndSheetOpen}
          title="종료 시간을 선택해 주세요"
        >
          <div className="mt-2 grid grid-cols-3 gap-3">
            <div className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-black/5 p-2">
              <div
                className={`flex h-10 items-center justify-center rounded-md text-sm ${
                  Number(endDraft.hour) < 12
                    ? "bg-[#17171c]/5 text-[#17171c]"
                    : "text-[#17171c]/40"
                }`}
              >
                오전
              </div>
              <div
                className={`flex h-10 items-center justify-center rounded-md text-sm ${
                  Number(endDraft.hour) >= 12
                    ? "bg-[#17171c]/5 text-[#17171c]"
                    : "text-[#17171c]/40"
                }`}
              >
                오후
              </div>
            </div>
            <div
              ref={endHourListRef}
              className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-black/5 p-2"
            >
              {hours.map((hour) => (
                <Button
                  key={`end-drawer-hour-${hour}`}
                  type="button"
                  variant={endDraft.hour === hour ? "default" : "ghost"}
                  className="w-full justify-start"
                  data-value={hour}
                  onClick={() => setEndDraft((prev) => ({ ...prev, hour }))}
                >
                  {formatHour12(hour)}시
                </Button>
              ))}
            </div>
            <div
              ref={endMinuteListRef}
              className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-black/5 p-2"
            >
              {minutes.map((minute) => (
                <Button
                  key={`end-drawer-min-${minute}`}
                  type="button"
                  variant={endDraft.minute === minute ? "default" : "ghost"}
                  className="w-full justify-start"
                  data-value={minute}
                  onClick={() => setEndDraft((prev) => ({ ...prev, minute }))}
                >
                  {minute}분
                </Button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <Button
              className="h-12 w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
              onClick={() => {
                setForm((prev) => ({
                  ...prev,
                  end_time: `${endDraft.hour}:${endDraft.minute}`,
                }));
                setEndSheetOpen(false);
              }}
            >
              적용하기
            </Button>
          </div>
        </BottomSheet>
      </main>
    </MobileContainer>
  );
}

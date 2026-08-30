"use client";

import { useEffect, useRef, useState } from "react";
import AnimatedImage from "@/components/ui/animated-image";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";

import { format } from "date-fns";
import { ko } from "date-fns/locale";
import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import BottomSheet from "@/components/sheets/BottomSheet";
import { sendHapticToApp } from "@/lib/reactNativeWebView";
import { Button } from "@/components/ui/button";
import ImageViewer from "@/components/ui/image-viewer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Label } from "@/components/ui/label";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import { formatSeoulDateKey, parseDateKey } from "@/lib/kstDateTime";
import { supabase } from "@/lib/supabaseClient";
import { ensureSessionOrLogin } from "@/lib/authSession";
import { invalidateProfileCache } from "@/lib/profileCache";
import { invalidateProfileRecordsCache } from "@/lib/profileRecordsCache";
import { markRecordDatesChanged } from "@/lib/recordChangeFlags";
import { Activity, CalendarDays, CheckCircle, Clock, Flame, Heart, HeartPulse, Layers, MapPin, Menu, PenLine, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

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
  outfit: string | null;
  memo: string | null;
  workout_activity_label: string | null;
  workout_source_name: string | null;
  workout_device_name: string | null;
  workout_active_energy_kcal: number | null;
  workout_total_energy_kcal: number | null;
  workout_avg_bpm: number | null;
  workout_max_bpm: number | null;
  status: string;
  recurrence_id: string | null;
  updated_at: string;
};

type MediaItem = {
  id: string;
  media_type: string;
  url: string;
  deleted_at: string | null;
};

const formatMeridiem = (hour: number) => (hour < 12 ? "오전" : "오후");
const formatHour12 = (hour: number) => {
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return String(normalized).padStart(2, "0");
};
const formatTimeLabel = (time: string) => {
  const [hour, minute] = time.split(":");
  const hourValue = Number(hour);
  return `${formatMeridiem(hourValue)} ${formatHour12(hourValue)}시 ${minute}분`;
};

const calculateDuration = (start: string, end: string) => {
  const [sh, sm] = start.split(":").map((value) => Number(value));
  const [eh, em] = end.split(":").map((value) => Number(value));
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  const diff = Math.max(endMinutes - startMinutes, 0);
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  return { hours, minutes };
};

const formatDateLabel = (dateStr: string) => {
  const date = parseDateKey(dateStr);
  const weekdayLabel = !date || Number.isNaN(date.getTime())
    ? ""
    : format(date, "yyyy년 MM월 dd일(EEE)", { locale: ko });
  return weekdayLabel || dateStr;
};

const formatTimeRangeLine = (start: string, end: string) => {
  const duration = calculateDuration(start, end);
  return `${formatTimeLabel(start)} - ${formatTimeLabel(
    end
  )} (총 ${duration.hours}시간 ${duration.minutes}분)`;
};

const parseOrderTags = (value: string | null) =>
  value
    ? value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];

const LOCATION_DELIMITER = " | ";
const ADDRESS_DELIMITER = " || ";

const parseLocationValue = (value: string | null) => {
  if (!value) return { name: "", base: "", detail: "" };
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
  return { name: value.trim(), base: "", detail: "" };
};

export default function RecordDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [record, setRecord] = useState<RecordDetail | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [recurrenceDeleteDialogOpen, setRecurrenceDeleteDialogOpen] = useState(false);
  const [deletingRecurrence, setDeletingRecurrence] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const mediaScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchRecord = async () => {
      if (loading) return;
      if (!user) {
        openLoginSheet();
        return;
      }

      // 상세 표시 — status 필터 없음. select에 status·recurrence_id 포함(G2: "남은 삭제" 액션 노출 판단용)
      const { data } = await supabase
        .from("records")
        .select(
          "id,record_date,start_time,end_time,content,mood,location,level,instructor,bar_order,center_order,did_well,improve_next,outfit,memo,workout_activity_label,workout_source_name,workout_device_name,workout_active_energy_kcal,workout_total_energy_kcal,workout_avg_bpm,workout_max_bpm,status,recurrence_id,updated_at,record_media(id,media_type,url,deleted_at)"
        )
        .eq("id", params.id)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .single();

      setRecord((data as RecordDetail) ?? null);
      // APP_AGENTS.md: deleted_at 소프트 삭제 규칙 — 클라이언트 후처리
      setMedia(((data as (RecordDetail & { record_media: MediaItem[] }) | null)?.record_media ?? []).filter((m) => !m.deleted_at));
      setActiveMediaIndex(0);
    };

    fetchRecord();
  }, [params.id, user, router, loading, openLoginSheet]);

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
        <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-xs text-[#17171c]/70">
            로그인하면 기록을 확인할 수 있어요.
          </p>
        </main>
      </MobileContainer>
    );
  }

  if (!record) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen items-center justify-center">
          <Spinner size="lg" />
        </main>
      </MobileContainer>
    );
  }

  const handleDelete = async () => {
    if (!user) {
      openLoginSheet();
      return;
    }
    const session = await ensureSessionOrLogin(openLoginSheet);
    if (!session) return;
    setDeleting(true);
    const response = await fetch(`/api/records/${record.id}/delete`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    if (!response.ok) {
      setDeleting(false);
      toast("기록을 삭제하지 못했어요.");
      return;
    }

    invalidateProfileCache(user.id);
    invalidateProfileRecordsCache(user.id);
    sessionStorage.setItem(`record-changed:${record.record_date}`, "1");
    router.back();
  };

  // §9.4/§11.2.PATCH: 예정을 무드 없이 완료 처리. records_enforce_status_monotonic 트리거가
  // status를 'done'으로 확정하므로, 서버에는 기존 필드값 그대로 + complete:true만 실어 보낸다
  // (PATCH가 부분 patch가 아니라 전체 스냅샷 덮어쓰기이기 때문 — §11.5).
  const handleCompleteWithoutMood = async () => {
    if (!user || !record) {
      openLoginSheet();
      return;
    }
    const session = await ensureSessionOrLogin(openLoginSheet);
    if (!session) return;
    setCompleting(true);
    let response: Response;
    try {
      response = await fetch(`/api/records/${record.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          record_date: record.record_date,
          start_time: record.start_time,
          end_time: record.end_time,
          content: record.content ?? "",
          mood: record.mood,
          location: record.location ?? "",
          level: record.level ?? "",
          instructor: record.instructor ?? "",
          bar_order: record.bar_order ?? "",
          center_order: record.center_order ?? "",
          did_well: record.did_well ?? "",
          improve_next: record.improve_next ?? "",
          outfit: record.outfit ?? "",
          memo: record.memo ?? "",
          workout_activity_label: record.workout_activity_label,
          workout_source_name: record.workout_source_name,
          workout_device_name: record.workout_device_name,
          workout_active_energy_kcal: record.workout_active_energy_kcal,
          workout_total_energy_kcal: record.workout_total_energy_kcal,
          workout_avg_bpm: record.workout_avg_bpm,
          workout_max_bpm: record.workout_max_bpm,
          complete: true,
          expected_updated_at: record.updated_at,
        }),
      });
    } catch {
      setCompleting(false);
      toast("네트워크 연결을 확인하고 다시 시도해 주세요.");
      return;
    }

    setCompleting(false);
    if (!response.ok) {
      if (response.status === 409) {
        toast("다른 기기에서 방금 이 기록이 바뀌었어요. 새로고침해 주세요.");
      } else {
        toast("완료 처리에 실패했어요.");
      }
      return;
    }

    invalidateProfileCache(user.id);
    invalidateProfileRecordsCache(user.id);
    sessionStorage.setItem(`record-changed:${record.record_date}`, "1");
    setRecord((prev) => (prev ? { ...prev, status: "done" } : prev));
    toast("완료로 표시했어요.");
  };

  // §9.9/§11.8: "남은 예정 전체 삭제"(planned 카드) / "다음 예정 전체 삭제"(done 카드) —
  // 이미 구현된 DELETE /api/records/recurrences/[id]를 호출만 한다(재구현 금지). 그 엔드포인트가
  // 소유권(404/403), status='planned', deleted_at 스코프를 단일 원자적 UPDATE로 전부 처리한다.
  const handleDeleteRecurrence = async () => {
    if (!user || !record || !record.recurrence_id) {
      return;
    }
    const session = await ensureSessionOrLogin(openLoginSheet);
    if (!session) return;
    const wasPlanned = record.status === "planned";
    setDeletingRecurrence(true);
    let response: Response;
    try {
      response = await fetch(`/api/records/recurrences/${record.recurrence_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    } catch {
      setDeletingRecurrence(false);
      toast("네트워크 연결을 확인하고 다시 시도해 주세요.");
      return;
    }

    setDeletingRecurrence(false);
    if (!response.ok) {
      // §9.12 삭제 부분 실패 카피 재사용(서버는 단일 UPDATE라 원자적이지만, 요청 자체가
      // 실패하는 경우도 동일 카피로 안내).
      toast("일부 예정을 삭제하지 못했어요. 다시 시도해 주세요.");
      return;
    }

    const payload = (await response.json().catch(() => null)) as
      | { cancelledDates?: string[] }
      | null;
    const cancelledDates = payload?.cancelledDates ?? [];

    // §11.3: 취소된 날짜가 여러 달에 걸칠 수 있다 — 날짜별로 dirty flag를 남겨 day뷰까지
    // 반영시키고, 프로필 캐시는 유저 단위 1회 호출로 충분하다.
    invalidateProfileCache(user.id);
    invalidateProfileRecordsCache(user.id);
    markRecordDatesChanged(cancelledDates);

    // 지금 보고 있던 기록 자체가 planned였다면 이번 삭제로 함께 취소됐으므로(§11.8 WHERE
    // status='planned') 더 이상 존재하지 않는 상세 화면을 벗어난다. done 카드에서 실행한
    // "다음 예정 전체 삭제"는 현재 기록 자체는 그대로라 화면에 머문다.
    if (wasPlanned) {
      router.back();
      return;
    }
    toast("남은 예정을 모두 삭제했어요.");
  };

  const isPlanned = record.status === "planned";
  const isPastPlanned = isPlanned && record.record_date < formatSeoulDateKey();

  const barOrderTags = parseOrderTags(record.bar_order);
  const centerOrderTags = parseOrderTags(record.center_order);
  const hasWorkoutInfo =
    !!record.workout_activity_label ||
    !!record.workout_source_name ||
    !!record.workout_device_name ||
    record.workout_active_energy_kcal !== null ||
    record.workout_total_energy_kcal !== null ||
    record.workout_avg_bpm !== null ||
    record.workout_max_bpm !== null;
  const locationParts = parseLocationValue(record.location);
  const locationAddress = [locationParts.base, locationParts.detail]
    .filter(Boolean)
    .join(" ");
  const locationDisplay = locationParts.name
    ? locationAddress
      ? `${locationParts.name}\n${locationAddress}`
      : locationParts.name
    : locationAddress;
  const hasCard2 =
    !!record.mood || !!record.content || hasWorkoutInfo ||
    !!record.did_well || !!record.improve_next || !!record.memo;
  const hasCard3 = barOrderTags.length > 0 || centerOrderTags.length > 0;

  return (
    <MobileContainer>
      {deleting || completing || deletingRecurrence ? <LoadingOverlay /> : null}
      <main className="px-4 pb-10">
        <PageHeader
          title="기록 상세"
          className="mb-6"
          right={
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="text-[#17171c]/70"
              onClick={() => setMenuOpen(true)}
              aria-label="기록 메뉴"
            >
              <Menu className="size-6" />
            </Button>
          }
        />

        <div className="space-y-3">
          {/* §9.2: 지난(놓친) 예정 안내 — 경고색 미사용, opacity 스케일만 */}
          {isPastPlanned ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[#17171c]/20 bg-[#17171c]/5 px-4 py-3">
              <span className="text-sm text-[#17171c]/60">지난 예정이에요</span>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 text-xs"
                  onClick={() => {
                    sendHapticToApp();
                    setCompleteDialogOpen(true);
                  }}
                >
                  완료로 표시
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 text-xs text-red-500 hover:text-red-500"
                  onClick={() => {
                    sendHapticToApp();
                    setDeleteDialogOpen(true);
                  }}
                >
                  삭제
                </Button>
              </div>
            </div>
          ) : null}

          {/* 사진/영상 — §9.11: 예정 상태는 미디어를 첨부할 수 없어 원천적으로 비어 있음(회귀 아님) */}
          {media.length > 0 ? (
            <section className="space-y-3">
              <div
                ref={mediaScrollRef}
                className="no-scrollbar flex snap-x snap-mandatory gap-0 overflow-x-auto pb-1"
                onScroll={() => {
                  const container = mediaScrollRef.current;
                  if (!container) return;
                  const width = container.clientWidth;
                  if (!width) return;
                  const nextIndex = Math.round(container.scrollLeft / width);
                  setActiveMediaIndex((prev) =>
                    prev === nextIndex ? prev : nextIndex
                  );
                }}
              >
                {media.map((item) => (
                  <div
                    key={item.id}
                    className="min-w-full shrink-0 snap-center snap-always overflow-hidden rounded-2xl bg-white"
                  >
                    <AspectRatio ratio={1}>
                      {item.media_type === "video" ? (
                        <video
                          controls
                          className="h-full w-full object-contain"
                        >
                          <source src={item.url} />
                        </video>
                      ) : (
                        <button
                          type="button"
                          className="h-full w-full"
                          onClick={() => {
                            sendHapticToApp();
                            setViewerUrl(item.url);
                            setViewerOpen(true);
                          }}
                          aria-label="업로드 사진 크게 보기"
                        >
                          <AnimatedImage
                            src={item.url}
                            alt="업로드 사진"
                            width={430}
                            height={430}
                            sizes="(max-width: 430px) 100vw, 430px"
                            draggable={false}
                            className="h-full w-full object-contain"
                          />
                        </button>
                      )}
                    </AspectRatio>
                  </div>
                ))}
              </div>
              {media.length > 1 ? (
                <div className="flex items-center justify-center gap-1.5">
                  {media.map((item, index) => (
                    <span
                      key={`media-dot-${item.id}`}
                      className={`h-1.5 w-1.5 rounded-full transition ${
                        index === activeMediaIndex
                          ? "bg-[#17171c]"
                          : "bg-[#17171c]/15"
                      }`}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {/* 카드 1: 날짜 / 장소 / 선생님 */}
          <div className="rounded-2xl border border-[#17171c]/5 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#17171c]/40" />
              <span className="text-sm text-[#17171c]">
                {formatDateLabel(record.record_date)}
              </span>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#17171c]/40" />
              <span className="text-sm text-[#17171c]">
                {formatTimeRangeLine(record.start_time, record.end_time)}
              </span>
            </div>
            {record.location && locationDisplay ? (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#17171c]/40" />
                <span className="whitespace-pre-line text-sm text-[#17171c]">
                  {locationDisplay}
                </span>
              </div>
            ) : null}
            {record.instructor ? (
              <div className="flex items-start gap-3">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-[#17171c]/40" />
                <span className="text-sm text-[#17171c]">
                  {record.instructor}
                </span>
              </div>
            ) : null}
            {record.level ? (
              <div className="flex items-start gap-3">
                <Layers className="mt-0.5 h-4 w-4 shrink-0 text-[#17171c]/40" />
                <span className="text-sm text-[#17171c]">{record.level}</span>
              </div>
            ) : null}
          </div>

          {/* 카드 2: 기분 / 기록 / 회고 */}
          {hasCard2 ? (
            <div className="rounded-2xl border border-[#17171c]/5 bg-white p-5 shadow-sm space-y-4">
              {record.mood ? (
                <div>
                  <Label className="text-sm text-[#17171c]/60">
                    오늘 발레는 어땠나요?
                  </Label>
                  <div className="mt-2">
                    <div className="h-20 w-20 rounded-full bg-white p-1">
                      <AnimatedImage
                        src={`/mood/mood_dark_face_${record.mood}.png`}
                        alt={`기분 ${record.mood}단계`}
                        width={1600}
                        height={1600}
                        unoptimized
                        draggable={false}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              {record.content ? (
                <div>
                  <Label className="text-sm text-[#17171c]/60">
                    한 줄로 가볍게 남겨주세요.
                  </Label>
                  <div className="mt-2 text-base text-[#17171c]">
                    {record.content}
                  </div>
                </div>
              ) : null}
              {record.did_well ? (
                <div>
                  <Label className="text-sm text-[#17171c]/60">
                    오늘 스스로 칭찬해 주고 싶은 점이 있나요?
                  </Label>
                  <div className="mt-2 whitespace-pre-line text-base text-[#17171c]">
                    {record.did_well}
                  </div>
                </div>
              ) : null}
              {record.improve_next ? (
                <div>
                  <Label className="text-sm text-[#17171c]/60">
                    다음에 더 신경 써보고 싶은 부분이 있나요?
                  </Label>
                  <div className="mt-2 whitespace-pre-line text-base text-[#17171c]">
                    {record.improve_next}
                  </div>
                </div>
              ) : null}
              {record.outfit ? (
                <div>
                  <Label className="text-sm text-[#17171c]/60">
                    오늘은 어떻게 발레복 코디를 했나요?
                  </Label>
                  <div className="mt-2 whitespace-pre-line text-base text-[#17171c]">
                    {record.outfit}
                  </div>
                </div>
              ) : null}
              {record.memo ? (
                <div>
                  <Label className="text-sm text-[#17171c]/60">
                    오늘 더 기억해 두고 싶은 이야기가 있나요?
                  </Label>
                  <div className="mt-2 whitespace-pre-line text-base text-[#17171c]">
                    {record.memo}
                  </div>
                </div>
              ) : null}
              {hasWorkoutInfo ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-[#17171c]/60">
                      Apple Watch 발레 바 운동
                    </Label>
                    <span className="text-xs text-[#17171c]/50">
                      {record.workout_device_name || "-"}
                    </span>
                  </div>
                  <div className="space-y-2 rounded-lg border border-[#17171c]/10 bg-white p-3">
                    <div className="flex items-center gap-2 text-sm text-[#17171c]/80">
                      <Activity className="h-4 w-4" />
                      <span>활동 칼로리 소모량:</span>
                      {record.workout_active_energy_kcal == null
                        ? "-"
                        : `${record.workout_active_energy_kcal} kcal`}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#17171c]/80">
                      <Flame className="h-4 w-4" />
                      <span>총 칼로리 소모량:</span>
                      {record.workout_total_energy_kcal == null
                        ? "-"
                        : `${record.workout_total_energy_kcal} kcal`}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#17171c]/80">
                      <Heart className="h-4 w-4" />
                      <span>평균 심박수:</span>
                      {record.workout_avg_bpm == null
                        ? "-"
                        : `${record.workout_avg_bpm} BPM`}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#17171c]/80">
                      <HeartPulse className="h-4 w-4" />
                      <span>최대 심박수:</span>
                      {record.workout_max_bpm == null
                        ? "-"
                        : `${record.workout_max_bpm} BPM`}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* 카드 3: 바 / 센터 순서 */}
          {hasCard3 ? (
            <div className="rounded-2xl border border-[#17171c]/5 bg-white p-5 shadow-sm space-y-4">
              {barOrderTags.length > 0 ? (
                <div>
                  <Label className="text-sm text-[#17171c]/60">
                    바(bar) 순서
                  </Label>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {barOrderTags.map((tag, index) => (
                      <div
                        key={`bar-order-${tag}-${index}`}
                        className="flex items-center gap-2"
                      >
                        <span className="rounded-full bg-[#17171c]/5 px-2 py-1 text-sm text-[#17171c]">
                          {tag}
                        </span>
                        {index < barOrderTags.length - 1 ? (
                          <span className="text-sm text-[#17171c]/40">
                            &gt;
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {centerOrderTags.length > 0 ? (
                <div>
                  <Label className="text-sm text-[#17171c]/60">
                    센터(center) 순서
                  </Label>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {centerOrderTags.map((tag, index) => (
                      <div
                        key={`center-order-${tag}-${index}`}
                        className="flex items-center gap-2"
                      >
                        <span className="rounded-full bg-[#17171c]/5 px-2 py-1 text-sm text-[#17171c]">
                          {tag}
                        </span>
                        {index < centerOrderTags.length - 1 ? (
                          <span className="text-sm text-[#17171c]/40">
                            &gt;
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <BottomSheet
          open={menuOpen}
          onOpenChange={setMenuOpen}
        >
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full justify-start text-sm"
              onClick={() => {
                setMenuOpen(false);
                router.push(`/record/${record.id}/edit`);
              }}
            >
              <PenLine className="mr-2 h-4 w-4" />
              수정하기
            </Button>
            {isPlanned ? (
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full justify-start text-sm"
                onClick={() => {
                  sendHapticToApp();
                  setMenuOpen(false);
                  setCompleteDialogOpen(true);
                }}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                감정 없이 완료하기
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full justify-start text-sm text-red-500 hover:text-red-500"
              onClick={() => {
                setMenuOpen(false);
                setDeleteDialogOpen(true);
              }}
            >
            <Trash2 className="mr-2 h-4 w-4" />
            삭제하기
            </Button>
            {record.recurrence_id ? (
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full justify-start text-sm text-red-500 hover:text-red-500"
                onClick={() => {
                  sendHapticToApp();
                  setMenuOpen(false);
                  setRecurrenceDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isPlanned ? "남은 예정 전체 삭제" : "다음 예정 전체 삭제"}
              </Button>
            ) : null}
          </div>
        </BottomSheet>
        <AlertDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>이 기록을 삭제할까요?</AlertDialogTitle>
              <AlertDialogDescription>
                삭제하면 복구할 수 없어요.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-row gap-2">
              <AlertDialogCancel className="flex-1">취소</AlertDialogCancel>
              <AlertDialogAction
                variant="outline"
                className="flex-1 text-red-500 hover:text-red-500"
                onClick={async () => {
                  setDeleteDialogOpen(false);
                  await handleDelete();
                }}
              >
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={completeDialogOpen}
          onOpenChange={setCompleteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>감정 없이 완료할까요?</AlertDialogTitle>
              <AlertDialogDescription>
                완료 후에는 예정으로 되돌릴 수 없어요.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-row gap-2">
              <AlertDialogCancel className="flex-1">취소</AlertDialogCancel>
              <AlertDialogAction
                variant="outline"
                className="flex-1"
                onClick={async () => {
                  setCompleteDialogOpen(false);
                  await handleCompleteWithoutMood();
                }}
              >
                완료
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={recurrenceDeleteDialogOpen}
          onOpenChange={setRecurrenceDeleteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isPlanned ? "남은 예정을 모두 삭제할까요?" : "다음 예정을 모두 삭제할까요?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                직접 시간 바꾼 예정도 함께 삭제돼요. 완료된 기록은 삭제되지 않아요.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-row gap-2">
              <AlertDialogCancel className="flex-1">취소</AlertDialogCancel>
              <AlertDialogAction
                variant="outline"
                className="flex-1 text-red-500 hover:text-red-500"
                onClick={async () => {
                  setRecurrenceDeleteDialogOpen(false);
                  await handleDeleteRecurrence();
                }}
              >
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <ImageViewer
          isOpen={viewerOpen}
          imageUrl={viewerUrl}
          alt="기록 이미지 크게 보기"
          onClose={() => setViewerOpen(false)}
        />
      </main>
    </MobileContainer>
  );
}

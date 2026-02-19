"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { format } from "date-fns";
import { ko } from "date-fns/locale";
import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import BottomSheet from "@/components/sheets/BottomSheet";
import { Button } from "@/components/ui/button";
import FadeInImage from "@/components/ui/fade-in-image";
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
import { Spinner } from "@/components/ui/spinner";
import { parseDateKey } from "@/lib/kstDateTime";
import { supabase } from "@/lib/supabaseClient";
import { ensureSessionOrLogin } from "@/lib/authSession";
import { ChevronLeft, Menu, PenLine, Trash2 } from "lucide-react";
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
};

type MediaItem = {
  id: string;
  media_type: string;
  url: string;
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
    const response = await fetch(`/api/records/${record.id}/delete`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    if (!response.ok) {
      toast("기록을 삭제하지 못했어요.");
      return;
    }

    router.replace(`/day/${record.record_date}`);
  };

  const barOrderTags = parseOrderTags(record.bar_order);
  const centerOrderTags = parseOrderTags(record.center_order);
  const hasExtraInfo =
    !!record.location ||
    !!record.level ||
    !!record.instructor ||
    !!record.did_well ||
    !!record.improve_next ||
    barOrderTags.length > 0 ||
    centerOrderTags.length > 0;
  const showLevelInstructor = !!record.level || !!record.instructor;
  const locationParts = parseLocationValue(record.location);
  const locationAddress = [locationParts.base, locationParts.detail]
    .filter(Boolean)
    .join(" ");
  const locationDisplay = locationParts.name
    ? locationAddress
      ? `${locationParts.name} / ${locationAddress}`
      : locationParts.name
    : locationAddress;

  return (
    <MobileContainer>
      <main className="px-4 pb-10 pt-2">
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
          <h1 className="text-base font-semibold">기록 상세</h1>
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
        </header>

        <div className="space-y-8">
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
                            setViewerUrl(item.url);
                            setViewerOpen(true);
                          }}
                          aria-label="업로드 사진 크게 보기"
                        >
                          <FadeInImage
                            src={item.url}
                            alt="업로드 사진"
                            animation="none"
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
                          : "bg-black/15"
                      }`}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="space-y-4">
            <Label className="text-sm text-[#17171c]/60">날짜와 시간</Label>
            <div className="mt-2 text-base text-[#17171c]">
              <div>{formatDateLabel(record.record_date)}</div>
              <div>
                {formatTimeRangeLine(record.start_time, record.end_time)}
              </div>
            </div>
            {record.location && locationDisplay ? (
              <div className="pt-2">
                <Label className="text-sm text-[#17171c]/60">장소</Label>
                <div className="mt-2 text-base text-[#17171c]">
                  {locationDisplay}
                </div>
              </div>
            ) : null}
            {showLevelInstructor ? (
              <div className="grid grid-cols-2 gap-3">
                {record.instructor ? (
                  <div>
                <Label className="text-sm text-[#17171c]/60">강사님</Label>
                    <div className="mt-2 text-base text-[#17171c]">
                      {record.instructor}
                    </div>
                  </div>
                ) : null}
                {record.level ? (
                  <div>
                    <Label className="text-sm text-[#17171c]/60">레벨</Label>
                    <div className="mt-2 text-base text-[#17171c]">
                      {record.level}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {record.mood ? (
              <div className="pt-2">
                <Label className="text-sm text-[#17171c]/60">
                  오늘 발레는 어땠나요?
                </Label>
                <div className="mt-2 grid w-full grid-cols-5 gap-2">
                  <div className="aspect-square w-full rounded-full bg-[#17171c]/5 p-3">
                    <FadeInImage
                      src={`/mood/cat-${record.mood}.svg`}
                      alt={`기분 ${record.mood}단계`}
                      animation="none"
                      className="h-full w-full object-contain"
                    />
                  </div>
                </div>
              </div>
            ) : null}
            {record.content ? (
              <div className="pt-2">
                <Label className="text-sm text-[#17171c]/60">
                  오늘의 발레를 한줄로 남겨보아요.
                </Label>
                <div className="mt-2 text-base text-[#17171c]">
                  {record.content}
                </div>
              </div>
            ) : null}
          </section>

          {hasExtraInfo ? (
            <>

              <section className="space-y-4">
                {record.did_well ? (
                  <div>
                    <Label className="text-sm text-[#17171c]/60">
                      오늘 잘했던 점을 남겨볼까요?
                    </Label>
                    <div className="mt-2 whitespace-pre-line text-base text-[#17171c]">
                      {record.did_well}
                    </div>
                  </div>
                ) : null}
                {record.improve_next ? (
                  <div>
                    <Label className="text-sm text-[#17171c]/60">
                      다음에는 무엇을 조금 더 신경 쓰면 좋을까요?
                    </Label>
                    <div className="mt-2 whitespace-pre-line text-base text-[#17171c]">
                      {record.improve_next}
                    </div>
                  </div>
                ) : null}
                {barOrderTags.length > 0 ? (
                  <div className="space-y-3">
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
                  <div className="space-y-3">
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
              </section>
            </>
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

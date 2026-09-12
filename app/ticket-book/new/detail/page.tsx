"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Plus, Star, X } from "lucide-react";

import MobileContainer from "@/components/layout/MobileContainer";
import AnimatedImage from "@/components/ui/animated-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { ensureSessionOrLogin } from "@/lib/authSession";
import { compressImage } from "@/lib/compressImage";
import { formatSeoulDateKey, isValidDateKey } from "@/lib/kstDateTime";
import { sendHapticToApp } from "@/lib/reactNativeWebView";
import { supabase } from "@/lib/supabaseClient";
import { markTicketChanged } from "@/lib/ticketBookCache";
import { toast } from "sonner";

const MAX_IMAGES = 3;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_TEXT_LEN = 50;
const BUCKET = "record-media";

type PreviewItem = { file: File; url: string };

function getSafeFileName(file: File) {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext ?? "jpg"}`;
}

function TicketDetailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();

  const performanceId = searchParams.get("performanceId");
  const isCustom = searchParams.get("custom") === "1";
  const dateParam = searchParams.get("date");

  const [perf, setPerf] = useState<{
    prfnm: string | null;
    fcltynm: string | null;
    poster: string | null;
  } | null>(null);
  const [fetching, setFetching] = useState(Boolean(performanceId));

  const [customTitle, setCustomTitle] = useState("");
  const [customVenue, setCustomVenue] = useState("");
  const [watchedOn, setWatchedOn] = useState(() =>
    dateParam && isValidDateKey(dateParam) ? dateParam : formatSeoulDateKey()
  );
  // 별점은 선택 항목이라 0이 "선택 안 함"이다. 저장 시 null로 보낸다.
  const [rating, setRating] = useState(0);
  const [seat, setSeat] = useState("");
  const [memo, setMemo] = useState("");
  const [mediaItems, setMediaItems] = useState<PreviewItem[]>([]);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // 저장은 티켓 생성 → 이미지 업로드 → 링크 3단계라, 중간에 실패하고 재시도할 때
  // 앞 단계를 다시 수행하면 티켓이 2건 생기거나 같은 파일이 다시 업로드된다.
  const createdTicketIdRef = useRef<string | null>(null);
  const uploadedUrlsRef = useRef<string[] | null>(null);

  // 파라미터 없이 직접 들어온 경우(주소 직접 입력, 잘못된 딥링크) 공연 선택으로 되돌린다.
  useEffect(() => {
    if (!performanceId && !isCustom) router.replace("/ticket-book/new");
  }, [performanceId, isCustom, router]);

  // 검색 결과 객체를 들고 오지 않고 id로 다시 조회한다 — 어느 경로로 진입해도 상태가 복원된다.
  useEffect(() => {
    if (!performanceId) return;
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("kopis_performances")
        .select("prfnm,fcltynm,poster")
        .eq("mt20id", performanceId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        toast("공연 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        setFetching(false);
        return;
      }
      setPerf(data);
      setFetching(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [performanceId]);

  // 언마운트 시 blob URL 해제. deps를 비운 채 mediaItems를 직접 참조하면 초기값(빈 배열)이
  // 캡처돼 실제로는 아무것도 해제되지 않으므로, 최신 목록을 ref로 따로 들고 있는다.
  const mediaItemsRef = useRef<PreviewItem[]>([]);
  useEffect(() => {
    mediaItemsRef.current = mediaItems;
  }, [mediaItems]);
  useEffect(() => {
    return () => {
      mediaItemsRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, []);

  const handleSelectFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE || mediaItems.length >= MAX_IMAGES) {
      event.target.value = "";
      return;
    }
    // 선택이 바뀌면 이전 업로드 결과는 더 이상 유효하지 않다.
    uploadedUrlsRef.current = null;
    setMediaItems((prev) =>
      [...prev, { file, url: URL.createObjectURL(file) }].slice(0, MAX_IMAGES)
    );
    event.target.value = "";
  };

  const handleRemoveImage = (index: number) => {
    sendHapticToApp();
    uploadedUrlsRef.current = null;
    setMediaItems((prev) => {
      const next = [...prev];
      next.splice(index, 1).forEach((item) => URL.revokeObjectURL(item.url));
      return next;
    });
  };

  const handleSubmit = useCallback(async () => {
    if (saving) return;
    if (!isValidDateKey(watchedOn)) {
      toast("관람 날짜를 확인해 주세요.");
      return;
    }
    if (isCustom && !customTitle.trim()) {
      toast("공연명을 입력해 주세요.");
      return;
    }

    setSaving(true);
    sendHapticToApp();

    const session = await ensureSessionOrLogin(openLoginSheet);
    if (!session) {
      setSaving(false);
      return;
    }

    try {
      // 1) 티켓 생성 — 재시도 시에는 이미 만든 티켓을 재사용한다(중복 생성 방지).
      let ticketId = createdTicketIdRef.current;
      if (!ticketId) {
        let res: Response;
        try {
          res = await fetch("/api/tickets", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              performance_id: performanceId,
              custom_title: isCustom ? customTitle : null,
              custom_venue: isCustom ? customVenue : null,
              watched_on: watchedOn,
              rating: rating > 0 ? rating : null,
              seat,
              memo,
            }),
          });
        } catch {
          setSaving(false);
          toast("티켓을 저장하지 못했어요. 다시 시도해 주세요.");
          return;
        }
        if (!res.ok) {
          setSaving(false);
          toast("티켓을 저장하지 못했어요. 다시 시도해 주세요.");
          return;
        }
        const json = await res.json().catch(() => null);
        if (!json?.id) {
          setSaving(false);
          toast("티켓을 저장하지 못했어요. 다시 시도해 주세요.");
          return;
        }
        ticketId = json.id as string;
        createdTicketIdRef.current = ticketId;
      }

      // 2) 이미지 업로드 + 링크 — 하나라도 실패하면 전부 붙이지 않는다(all-or-nothing).
      if (mediaItems.length > 0) {
        let uploadedUrls = uploadedUrlsRef.current;
        if (!uploadedUrls) {
          const results = await Promise.all(
            mediaItems.map(async (item) => {
              try {
                const compressed = await compressImage(item.file);
                // AuthProvider의 user가 아직 안 채워졌을 수 있으므로 세션의 id를 쓴다.
                const path = `${session.user.id}/performance-tickets/${ticketId}/${getSafeFileName(item.file)}`;
                const { error: uploadError } = await supabase.storage
                  .from(BUCKET)
                  .upload(path, compressed);
                if (uploadError) return null;
                const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
                return urlData.publicUrl;
              } catch {
                return null;
              }
            })
          );
          const succeeded = results.filter((url): url is string => Boolean(url));
          if (succeeded.length !== mediaItems.length) {
            setSaving(false);
            toast("사진을 첨부하지 못했어요. 다시 시도해 주세요.");
            return;
          }
          uploadedUrls = succeeded;
          uploadedUrlsRef.current = uploadedUrls;
        }

        // WKWebView에서 "Load failed"로 던질 수 있어 try/catch로 감싸고 응답까지 확인한다.
        let linkOk = false;
        try {
          const linkRes = await fetch(`/api/tickets/${ticketId}/images`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ urls: uploadedUrls }),
          });
          linkOk = linkRes.ok;
        } catch {
          linkOk = false;
        }
        if (!linkOk) {
          setSaving(false);
          toast("사진을 첨부하지 못했어요. 다시 시도해 주세요.");
          return;
        }
      }

      markTicketChanged(ticketId);
      createdTicketIdRef.current = null;
      uploadedUrlsRef.current = null;
      // back()을 쓰면 공연 선택(S3)으로 돌아간다 — 2단계 폼이므로 상세로 replace한다.
      router.replace(`/ticket/${ticketId}`);
    } catch {
      setSaving(false);
      toast("티켓을 저장하지 못했어요. 다시 시도해 주세요.");
    }
  }, [
    saving, watchedOn, isCustom, customTitle, customVenue, performanceId,
    rating, seat, memo, mediaItems, openLoginSheet, router,
  ]);

  if (loading || fetching) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen items-center justify-center">
          <Spinner size="lg" />
        </main>
      </MobileContainer>
    );
  }

  const title = isCustom ? customTitle || "직접 입력" : (perf?.prfnm ?? "제목 없음");

  return (
    <MobileContainer>
      <main className="flex min-h-screen flex-col pb-28">
        <header className="sticky top-0 z-20 flex h-12 items-center gap-1 bg-background px-1">
          <Button
            variant="ghost"
            size="icon-lg"
            className="text-[#17171c]/70"
            onClick={() => router.back()}
            aria-label="뒤로"
          >
            <ChevronLeft className="size-6" />
          </Button>
          <p className="text-lg font-bold">티켓 등록</p>
        </header>

        {/* 상단 공연 요약 — KOPIS 선택이면 읽기 전용 카드, 직접 입력이면 입력 필드 */}
        {isCustom ? (
          <section className="space-y-3 px-4 pt-2">
            <div>
              <Label htmlFor="ticket-title">공연명</Label>
              <Input
                id="ticket-title"
                value={customTitle}
                maxLength={MAX_TEXT_LEN}
                onChange={(event) => setCustomTitle(event.target.value)}
                placeholder="공연명을 입력해 주세요"
                className="mt-1.5 h-12 text-base placeholder:text-sm"
              />
            </div>
            <div>
              <Label htmlFor="ticket-venue">장소</Label>
              <Input
                id="ticket-venue"
                value={customVenue}
                maxLength={MAX_TEXT_LEN}
                onChange={(event) => setCustomVenue(event.target.value)}
                placeholder="공연장을 입력해 주세요"
                className="mt-1.5 h-12 text-base placeholder:text-sm"
              />
            </div>
          </section>
        ) : (
          <section className="px-4 pt-2">
            <div className="flex items-center gap-3 rounded-2xl border border-[#17171c]/5 bg-white p-3 shadow-sm">
              {perf?.poster ? (
                <AnimatedImage
                  src={perf.poster}
                  alt=""
                  width={45}
                  height={64}
                  sizes="45px"
                  className="h-16 w-[45px] shrink-0 rounded-md bg-[#17171c]/5 object-cover"
                />
              ) : (
                <div className="h-16 w-[45px] shrink-0 rounded-md bg-[#17171c]/5" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{title}</p>
                {perf?.fcltynm && (
                  <p className="truncate text-xs text-[#17171c]/60">{perf.fcltynm}</p>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="space-y-4 px-4 pt-4">
          <div>
            <Label htmlFor="ticket-date">관람 날짜</Label>
            <Input
              id="ticket-date"
              type="date"
              value={watchedOn}
              onChange={(event) => setWatchedOn(event.target.value)}
              className="mt-1.5 h-12 text-base"
            />
          </div>

          <div>
            <Label>별점</Label>
            <div className="mt-1.5 flex items-center gap-1">
              {Array.from({ length: 5 }, (_, index) => {
                const starIndex = index + 1;
                const filled = rating >= starIndex * 2;
                return (
                  <button
                    key={starIndex}
                    type="button"
                    className="flex h-7 w-7 items-center justify-center"
                    aria-label={`${starIndex}점`}
                    onClick={() => {
                      sendHapticToApp();
                      // 이미 선택된 최상위 별을 다시 탭하면 해제(선택 안 함)된다.
                      // 기존 리뷰 별점 UI는 rating이 NOT NULL이라 해제가 없지만,
                      // 티켓의 별점은 선택 항목이라 되돌릴 방법이 필요하다.
                      setRating((prev) => (prev === starIndex * 2 ? 0 : starIndex * 2));
                    }}
                  >
                    <Star
                      className="h-6 w-6 text-brand"
                      fill={filled ? "currentColor" : "none"}
                    />
                  </button>
                );
              })}
              <span className="ml-2 text-sm text-[#17171c]/50">
                {rating > 0 ? `${rating / 2}점` : "선택 안 함"}
              </span>
            </div>
          </div>

          <div>
            <Label htmlFor="ticket-seat">좌석</Label>
            <Input
              id="ticket-seat"
              value={seat}
              onChange={(event) => setSeat(event.target.value)}
              placeholder="예) 1층 R석 15열 3번"
              className="mt-1.5 h-12 text-base placeholder:text-sm"
            />
          </div>

          <div>
            <Label htmlFor="ticket-memo">메모</Label>
            <Textarea
              id="ticket-memo"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="기억하고 싶은 순간을 남겨보세요"
              className="mt-1.5 min-h-[120px] text-base placeholder:text-sm"
            />
          </div>

          <div>
            <Label>사진 ({mediaItems.length}/{MAX_IMAGES})</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {mediaItems.map((item, index) => (
                <div key={item.url} className="relative aspect-square w-20 shrink-0">
                  {/* blob URL이라 next/image 최적화 대상이 아니다 — 미리보기는 img로 충분하다 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt=""
                    className="h-full w-full rounded-md object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    aria-label="사진 삭제"
                    className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[#17171c] text-white"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {mediaItems.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex aspect-square w-20 shrink-0 items-center justify-center rounded-md border border-dashed border-[#17171c]/20 text-[#17171c]/40"
                  aria-label="사진 추가"
                >
                  <Plus className="size-5" />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleSelectFiles}
            />
          </div>
        </section>
      </main>

      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-[#17171c]/5 bg-background px-4 py-3">
        <Button className="h-12 w-full" disabled={saving} onClick={() => void handleSubmit()}>
          등록하기
        </Button>
      </div>

      {saving && <LoadingOverlay />}
    </MobileContainer>
  );
}

export default function TicketDetailPage() {
  return (
    <Suspense
      fallback={
        <MobileContainer>
          <main className="flex min-h-screen items-center justify-center">
            <Spinner size="lg" />
          </main>
        </MobileContainer>
      }
    >
      <TicketDetailForm />
    </Suspense>
  );
}

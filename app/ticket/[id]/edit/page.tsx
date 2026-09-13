"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarDays, Plus, Star, X } from "lucide-react";

import MobileContainer from "@/components/layout/MobileContainer";
import DatePickerSheet from "@/components/sheets/DatePickerSheet";
import PageHeader from "@/components/layout/PageHeader";
import AnimatedImage from "@/components/ui/animated-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { ensureSessionOrLogin } from "@/lib/authSession";
import { compressImage } from "@/lib/compressImage";
import { getSeoulTodayDate, isValidDateKey, parseDateKey } from "@/lib/kstDateTime";
import { sendHapticToApp } from "@/lib/reactNativeWebView";
import { supabase } from "@/lib/supabaseClient";
import { markTicketChanged } from "@/lib/ticketBookCache";
import { toast } from "sonner";

const MAX_IMAGES = 3;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const BUCKET = "record-media";
const MAX_REVIEW_LEN = 300;

type PreviewItem = { file: File; url: string };
type ExistingImage = { id: string; url: string };

function getSafeFileName(file: File) {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext ?? "jpg"}`;
}

export default function TicketEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const ticketId = params?.id;
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();

  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState<string | null>(null);
  const [poster, setPoster] = useState<string | null>(null);
  const [watchedOn, setWatchedOn] = useState("");
  const [rating, setRating] = useState(0);
  const [seat, setSeat] = useState("");
  const [memo, setMemo] = useState("");
  // 리뷰가 없는 티켓에 한해 이 화면에서 리뷰를 쓸 수 있다. 이미 있는 리뷰의 수정은
  // 티켓 상세의 리뷰 카드 → 리뷰 상세 → 수정 경로가 따로 있으므로 여기서 중복하지 않는다.
  const [isCustom, setIsCustom] = useState(false);
  const [hasReview, setHasReview] = useState(false);
  const [reviewContent, setReviewContent] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [mediaItems, setMediaItems] = useState<PreviewItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadedUrlsRef = useRef<string[] | null>(null);
  const reviewCreatedRef = useRef(false);
  // 이미지 삭제는 하드 삭제라 같은 id로 재요청하면 403이 된다. 저장이 뒤 단계에서 실패해
  // 재시도할 때 이미 반영된 삭제분을 다시 보내지 않도록 적용된 id를 기억한다.
  // 재시도 전에 사진을 더 지울 수 있으므로 boolean이 아니라 id 목록으로 들고 있어야 한다.
  const appliedRemovedIdsRef = useRef<string[]>([]);

  // 삭제 예정으로 표시한 기존 이미지는 개수에서 뺀다. existingImages.length를 쓰면
  // "기존 3장 중 2장 삭제 + 1장 추가"처럼 최종 2장이 되는 정상 편집이 막힌다.
  const visibleExisting = existingImages.filter((image) => !removedImageIds.includes(image.id));
  const canUploadMore = mediaItems.length + visibleExisting.length < MAX_IMAGES;

  const mediaItemsRef = useRef<PreviewItem[]>([]);
  useEffect(() => {
    mediaItemsRef.current = mediaItems;
  }, [mediaItems]);
  useEffect(() => {
    return () => {
      mediaItemsRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user || !ticketId) {
      setFetching(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const session = await ensureSessionOrLogin(openLoginSheet);
      if (!session) {
        setFetching(false);
        return;
      }
      try {
        const res = await fetch(`/api/tickets/${ticketId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (cancelled) return;
        if (res.status === 404 || res.status === 403) {
          setNotFound(true);
          setFetching(false);
          return;
        }
        if (!res.ok) {
          toast("티켓 정보를 불러오지 못했어요.");
          setFetching(false);
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        setTitle(json.performance?.prfnm || json.ticket.customTitle || "제목 없음");
        setVenue(json.performance?.fcltynm || json.ticket.customVenue || null);
        setPoster(json.performance?.poster ? json.performance.poster : null);
        setWatchedOn(json.ticket.watchedOn);
        setRating(json.ticket.rating ?? 0);
        setSeat(json.ticket.seat ?? "");
        setMemo(json.ticket.memo ?? "");
        setExistingImages(json.images ?? []);
        setIsCustom(!json.ticket.performanceId);
        setHasReview(Boolean(json.review));
      } catch {
        if (!cancelled) toast("티켓 정보를 불러오지 못했어요.");
      } finally {
        if (!cancelled) setFetching(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [loading, user, ticketId, openLoginSheet]);

  const handleSelectFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE || !canUploadMore) {
      event.target.value = "";
      return;
    }
    uploadedUrlsRef.current = null;
    setMediaItems((prev) => [...prev, { file, url: URL.createObjectURL(file) }]);
    event.target.value = "";
  };

  const handleRemoveNew = (index: number) => {
    sendHapticToApp();
    uploadedUrlsRef.current = null;
    setMediaItems((prev) => {
      const next = [...prev];
      next.splice(index, 1).forEach((item) => URL.revokeObjectURL(item.url));
      return next;
    });
  };

  const handleSubmit = useCallback(async () => {
    if (saving || !ticketId) return;
    if (!isValidDateKey(watchedOn)) {
      toast("관람 날짜를 확인해 주세요.");
      return;
    }
    // 리뷰가 없는 KOPIS 공연 티켓에 한해 이 화면에서 리뷰를 새로 쓸 수 있다.
    const wantsReview = !isCustom && !hasReview && reviewContent.trim().length > 0;
    if (wantsReview && rating === 0) {
      toast("리뷰를 쓰려면 별점도 선택해 주세요.");
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
      // 1) 본문 수정 — 네 필드를 항상 전부 보내는 전체 교체 계약.
      let patchOk = false;
      try {
        const res = await fetch(`/api/tickets/${ticketId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            watched_on: watchedOn,
            rating: rating > 0 ? rating : null,
            seat,
            memo,
          }),
        });
        patchOk = res.ok;
      } catch {
        patchOk = false;
      }
      if (!patchOk) {
        setSaving(false);
        toast("티켓을 저장하지 못했어요. 다시 시도해 주세요.");
        return;
      }

      // 2) 삭제 예정 이미지 반영 — 이미 적용된 id는 제외한다(재요청 시 403 방지).
      const pendingRemoved = removedImageIds.filter(
        (id) => !appliedRemovedIdsRef.current.includes(id)
      );
      if (pendingRemoved.length > 0) {
        let deleteOk = false;
        try {
          const res = await fetch(`/api/tickets/${ticketId}/images`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ imageIds: pendingRemoved }),
          });
          deleteOk = res.ok;
        } catch {
          deleteOk = false;
        }
        if (!deleteOk) {
          setSaving(false);
          toast("사진을 삭제하지 못했어요. 다시 시도해 주세요.");
          return;
        }
        appliedRemovedIdsRef.current = [...appliedRemovedIdsRef.current, ...pendingRemoved];
      }

      // 3) 새 이미지 업로드 + 링크 — all-or-nothing.
      if (mediaItems.length > 0) {
        let uploadedUrls = uploadedUrlsRef.current;
        if (!uploadedUrls) {
          const results = await Promise.all(
            mediaItems.map(async (item) => {
              try {
                const compressed = await compressImage(item.file);
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

        let linkOk = false;
        try {
          const res = await fetch(`/api/tickets/${ticketId}/images`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ urls: uploadedUrls }),
          });
          linkOk = res.ok;
        } catch {
          linkOk = false;
        }
        if (!linkOk) {
          setSaving(false);
          toast("사진을 첨부하지 못했어요. 다시 시도해 주세요.");
          return;
        }
      }

      // 4) 리뷰 생성(선택) — 본문이 있을 때만. 409는 이미 만들어졌다는 뜻이라 성공으로 본다.
      if (wantsReview && !reviewCreatedRef.current) {
        let reviewRes: Response | null = null;
        try {
          reviewRes = await fetch(`/api/tickets/${ticketId}/review`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ rating, content: reviewContent, is_public: isPublic }),
          });
        } catch {
          reviewRes = null;
        }
        if (reviewRes?.status === 409) {
          reviewCreatedRef.current = true;
        } else if (!reviewRes?.ok) {
          setSaving(false);
          toast("리뷰를 저장하지 못했어요. 다시 시도해 주세요.");
          return;
        } else {
          reviewCreatedRef.current = true;
        }
      }

      markTicketChanged(ticketId);
      uploadedUrlsRef.current = null;
      appliedRemovedIdsRef.current = [];
      reviewCreatedRef.current = false;
      router.back();
    } catch {
      setSaving(false);
      toast("티켓을 저장하지 못했어요. 다시 시도해 주세요.");
    }
  }, [
    saving, ticketId, watchedOn, rating, seat, memo,
    removedImageIds, mediaItems, isCustom, hasReview, reviewContent, isPublic,
    openLoginSheet, router,
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

  if (notFound) {
    return (
      <MobileContainer>
        <main className="px-4 pb-10">
          <PageHeader title="티켓 수정" className="mb-6" />
          <p className="mt-20 text-center text-sm text-[#17171c]/60">
            티켓 정보를 찾을 수 없어요.
          </p>
        </main>
      </MobileContainer>
    );
  }

  return (
    <MobileContainer>
      {saving ? <LoadingOverlay /> : null}
      <main className="px-4 pb-12">
        <PageHeader title="티켓 수정" className="mb-6" />

        {/* 등록 화면과 같은 리듬 — 바깥을 space-y-8로 묶는다 */}
        <div className="space-y-8">
          <section className="space-y-4">
            {/* 미디어 — 기록 수정과 동일한 구조(추가 버튼이 맨 앞, 가로 스크롤) */}
            <div className="space-y-3">
              <Label className="text-sm text-[#17171c]/60">미디어 업로드</Label>
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 pr-2">
                {canUploadMore && (
                  <button
                    type="button"
                    className="relative aspect-square w-20 shrink-0 rounded-lg border border-dashed border-[#17171c]/10 bg-transparent"
                    onClick={() => {
                      sendHapticToApp();
                      fileInputRef.current?.click();
                    }}
                    aria-label="사진 추가"
                  >
                    <Plus className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-[#17171c]/40" />
                  </button>
                )}
                {visibleExisting.map((image) => (
                  <div
                    key={image.id}
                    className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-lg bg-white"
                  >
                    <AnimatedImage
                      src={image.url}
                      alt="업로드 사진"
                      width={80}
                      height={80}
                      sizes="80px"
                      className="h-full w-full object-contain"
                    />
                    <button
                      type="button"
                      className="absolute right-1 top-1 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-[#17171c] shadow-sm"
                      onClick={() => {
                        sendHapticToApp();
                        setRemovedImageIds((prev) => [...prev, image.id]);
                      }}
                      aria-label="업로드 사진 삭제"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {mediaItems.map((item, index) => (
                  <div
                    key={item.url}
                    className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-lg bg-white"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt="업로드 사진"
                      draggable={false}
                      className="h-full w-full object-contain"
                    />
                    <button
                      type="button"
                      className="absolute right-1 top-1 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-[#17171c] shadow-sm"
                      onClick={() => handleRemoveNew(index)}
                      aria-label="업로드 사진 삭제"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleSelectFiles}
              />
              <p className="text-xs text-[#17171c]/50">
                사진은 최대 {MAX_IMAGES}장까지 업로드할 수 있어요.
              </p>
            </div>

            {/* 공연 정보는 읽기 전용 — 공연 재선택은 지원하지 않는다. */}
            <div className="flex items-center gap-3 rounded-2xl border border-[#17171c]/5 bg-white p-3 shadow-sm">
              {poster ? (
                <AnimatedImage
                  src={poster}
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
                {venue ? <p className="truncate text-xs text-[#17171c]/60">{venue}</p> : null}
              </div>
            </div>

            <div>
              <Label className="text-sm text-[#17171c]/60">
                관람 날짜<span className="-ml-[1px] text-[#17171c]/50">*</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                className="mt-2 h-12 w-full justify-start gap-2 text-left text-sm font-normal"
                onClick={() => {
                  sendHapticToApp();
                  setDateSheetOpen(true);
                }}
              >
                <CalendarDays className="h-4 w-4" />
                {watchedOn
                  ? format(parseDateKey(watchedOn) ?? getSeoulTodayDate(), "yyyy년 MM월 dd일(EEE)", { locale: ko })
                  : "날짜를 선택해 주세요"}
              </Button>
            </div>

            <div>
              <Label htmlFor="ticket-seat" className="text-sm text-[#17171c]/60">좌석</Label>
              <Input
                id="ticket-seat"
                value={seat}
                onChange={(event) => setSeat(event.target.value)}
                placeholder="예) 1층 R석 15열 3번"
                className="mt-2 h-12 text-base placeholder:text-sm"
              />
            </div>

            <div>
              <Label htmlFor="ticket-memo" className="text-sm text-[#17171c]/60">메모</Label>
              <Textarea
                id="ticket-memo"
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                placeholder="기억하고 싶은 순간을 남겨보세요"
                className="mt-2 min-h-[120px] text-base placeholder:text-sm"
              />
            </div>
          </section>

          {/* 리뷰 — 직접 입력 공연은 커뮤니티 리뷰를 만들 수 없고, 이미 리뷰가 있으면
              리뷰 상세에서 수정하므로 여기서는 "아직 리뷰가 없는 KOPIS 공연"만 다룬다.
              구분선과 섹션을 같은 조건으로 묶어야 구분선만 남는 일이 없다. */}
          {isCustom || hasReview ? null : (
            <>
              <Separator />
              <section className="space-y-4">
                <h2 className="text-base font-semibold">공연 리뷰 등록</h2>

                <div>
                  <Label className="text-sm text-[#17171c]/60">별점</Label>
                  <div className="mt-2 flex items-center gap-1">
                    {Array.from({ length: 5 }, (_, index) => {
                      const starIndex = index + 1;
                      return (
                        <button
                          key={starIndex}
                          type="button"
                          className="flex h-7 w-7 items-center justify-center"
                          aria-label={`${starIndex}점`}
                          onClick={() => {
                            sendHapticToApp();
                            // 선택된 최상위 별을 다시 탭하면 해제된다(별점은 선택 항목).
                            // 이 값은 티켓의 별점이고, 연결된 리뷰가 있으면 서버가 리뷰
                            // 별점도 같은 값으로 맞춘다(PATCH /api/tickets/[id] 참고).
                            setRating((prev) => (prev === starIndex * 2 ? 0 : starIndex * 2));
                          }}
                        >
                          <Star
                            // 비활성 별까지 브랜드색이면 5개가 다 켜진 것처럼 보인다.
                            // 고른 개수가 한눈에 드러나도록 비활성은 연한 회색 외곽선으로 둔다.
                            className={
                              rating >= starIndex * 2 ? "h-6 w-6 text-brand" : "h-6 w-6 text-[#17171c]/20"
                            }
                            fill={rating >= starIndex * 2 ? "currentColor" : "none"}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ticket-review" className="text-sm text-[#17171c]/60">내용</Label>
                    <span className="text-xs text-[#17171c]/40">
                      {reviewContent.length}/{MAX_REVIEW_LEN}
                    </span>
                  </div>
                  <Textarea
                    id="ticket-review"
                    value={reviewContent}
                    maxLength={MAX_REVIEW_LEN}
                    onChange={(event) => setReviewContent(event.target.value)}
                    placeholder="관람 소감을 자유롭게 남겨보세요"
                    className="mt-2 min-h-[120px] text-base placeholder:text-sm"
                  />
                </div>

                <div>
                  <section className="rounded-xl border border-[#17171c]/5 bg-white">
                    <div className="flex items-center justify-between px-4 py-4">
                      <p className="text-sm font-medium text-[#17171c]">리뷰 공개</p>
                      <Switch size="lg" checked={isPublic} onCheckedChange={setIsPublic} />
                    </div>
                  </section>
                  <p className="mt-2 px-1 text-xs text-[#17171c]/50">
                    {isPublic
                      ? "누구나 볼 수 있는 공개 리뷰예요. 공연 상세의 리뷰 목록에 나타나요."
                      : "나만 볼 수 있는 비공개 리뷰예요."}
                  </p>
                </div>
              </section>
            </>
          )}

          {/* 별점은 리뷰 섹션 안에만 있으므로, 리뷰를 이미 쓴 티켓이나 직접 입력 티켓에도
              별점을 고칠 수 있도록 별도 섹션을 둔다. */}
          {isCustom || hasReview ? (
            <section className="space-y-4">
              <div>
                <Label className="text-sm text-[#17171c]/60">별점</Label>
                <div className="mt-2 flex items-center gap-1">
                  {Array.from({ length: 5 }, (_, index) => {
                    const starIndex = index + 1;
                    return (
                      <button
                        key={starIndex}
                        type="button"
                        className="flex h-7 w-7 items-center justify-center"
                        aria-label={`${starIndex}점`}
                        onClick={() => {
                          sendHapticToApp();
                          setRating((prev) => (prev === starIndex * 2 ? 0 : starIndex * 2));
                        }}
                      >
                        <Star
                          // 비활성 별까지 브랜드색이면 5개가 다 켜진 것처럼 보인다.
                          // 고른 개수가 한눈에 드러나도록 비활성은 연한 회색 외곽선으로 둔다.
                          className={
                            rating >= starIndex * 2 ? "h-6 w-6 text-brand" : "h-6 w-6 text-[#17171c]/20"
                          }
                          fill={rating >= starIndex * 2 ? "currentColor" : "none"}
                        />
                      </button>
                    );
                  })}
                </div>
                {hasReview ? (
                  <p className="mt-2 px-1 text-xs text-[#17171c]/50">
                    별점을 바꾸면 작성한 리뷰의 별점도 함께 바뀌어요.
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          <Button
            type="button"
            className="h-12 w-full"
            disabled={saving}
            onClick={() => void handleSubmit()}
          >
            저장하기
          </Button>
        </div>
      </main>

      <DatePickerSheet
        open={dateSheetOpen}
        onOpenChange={setDateSheetOpen}
        value={watchedOn}
        onConfirm={setWatchedOn}
      />
    </MobileContainer>
  );
}

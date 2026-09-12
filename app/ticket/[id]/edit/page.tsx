"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Star, X } from "lucide-react";

import MobileContainer from "@/components/layout/MobileContainer";
import PageHeader from "@/components/layout/PageHeader";
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
import { isValidDateKey } from "@/lib/kstDateTime";
import { sendHapticToApp } from "@/lib/reactNativeWebView";
import { supabase } from "@/lib/supabaseClient";
import { markTicketChanged } from "@/lib/ticketBookCache";
import { toast } from "sonner";

const MAX_IMAGES = 3;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const BUCKET = "record-media";

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
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [mediaItems, setMediaItems] = useState<PreviewItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadedUrlsRef = useRef<string[] | null>(null);
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

      markTicketChanged(ticketId);
      uploadedUrlsRef.current = null;
      appliedRemovedIdsRef.current = [];
      router.back();
    } catch {
      setSaving(false);
      toast("티켓을 저장하지 못했어요. 다시 시도해 주세요.");
    }
  }, [
    saving, ticketId, watchedOn, rating, seat, memo,
    removedImageIds, mediaItems, openLoginSheet, router,
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
      <main className="px-4 pb-28">
        <PageHeader title="티켓 수정" className="mb-4" />

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

        <section className="space-y-4 pt-4">
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
                return (
                  <button
                    key={starIndex}
                    type="button"
                    className="flex h-7 w-7 items-center justify-center"
                    aria-label={`${starIndex}점`}
                    onClick={() => {
                      sendHapticToApp();
                      // 선택된 최상위 별을 다시 탭하면 해제된다(별점은 선택 항목).
                      setRating((prev) => (prev === starIndex * 2 ? 0 : starIndex * 2));
                    }}
                  >
                    <Star
                      className="h-6 w-6 text-brand"
                      fill={rating >= starIndex * 2 ? "currentColor" : "none"}
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
            <Label>사진 ({visibleExisting.length + mediaItems.length}/{MAX_IMAGES})</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {visibleExisting.map((image) => (
                <div key={image.id} className="relative aspect-square w-20 shrink-0">
                  <AnimatedImage
                    src={image.url}
                    alt=""
                    width={80}
                    height={80}
                    sizes="80px"
                    className="h-full w-full rounded-md bg-[#17171c]/5 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      sendHapticToApp();
                      setRemovedImageIds((prev) => [...prev, image.id]);
                    }}
                    aria-label="사진 삭제"
                    className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[#17171c] text-white"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {mediaItems.map((item, index) => (
                <div key={item.url} className="relative aspect-square w-20 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt="" className="h-full w-full rounded-md object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveNew(index)}
                    aria-label="사진 삭제"
                    className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[#17171c] text-white"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {canUploadMore && (
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
          저장하기
        </Button>
      </div>
    </MobileContainer>
  );
}

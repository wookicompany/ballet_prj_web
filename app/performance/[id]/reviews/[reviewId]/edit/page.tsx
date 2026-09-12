"use client";

import { useEffect, useRef, useState } from "react";
import AnimatedImage from "@/components/ui/animated-image";
import { useParams, useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { ensureSessionOrLogin } from "@/lib/authSession";
import { invalidatePerformanceHomeCache } from "@/lib/performanceHomeCache";
import { invalidateDetailCache } from "@/lib/performanceDetailCache";
import { invalidateProfileCache } from "@/lib/profileCache";
import { sendHapticToApp } from "@/lib/reactNativeWebView";
import { compressImage } from "@/lib/compressImage";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Star, X } from "lucide-react";
import { toast } from "sonner";

const MAX_IMAGES = 3;
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const BUCKET = "record-media";

const getSafeFileName = (file: File) => {
  const timestamp = Date.now();
  return `${timestamp}-${file.name.replace(/\s+/g, "_")}`;
};

const getStarFillRatio = (rating10: number, starIndex: number) => {
  const value = rating10 / 2 - (starIndex - 1);
  return value >= 1 ? 1 : 0;
};

type PreviewItem = {
  file: File;
  url: string;
};

type ExistingImage = {
  id: string;
  url: string;
};

export default function PerformanceReviewEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string; reviewId: string }>();
  const performanceId = params.id;
  const reviewId = params.reviewId;
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [mediaItems, setMediaItems] = useState<PreviewItem[]>([]);
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);
  // 업로드는 성공했는데 링크(fetch)만 실패한 경우, 재시도 시 같은 URL을 재사용해
  // 스토리지에 중복 파일이 쌓이는 것을 막는다(reviews/new/page.tsx와 동일 관례).
  const uploadedUrlsRef = useRef<string[] | null>(null);
  // 이미지 삭제는 하드 삭제라 재요청 시 대상 행을 찾지 못해 403이 된다
  // (app/api/reviews/[id]/images/route.ts의 rows.length !== cleanedIds.length 분기).
  // 이미 반영된 id는 재시도에서 제외한다. 재시도 전에 사용자가 사진을 더 지울 수 있으므로
  // boolean이 아니라 "적용된 id 목록"으로 들고 있어야 새 삭제분이 누락되지 않는다.
  const appliedRemovedIdsRef = useRef<string[]>([]);

  const visibleExistingCount = existingImages.filter(
    (img) => !removedImageIds.includes(img.id)
  ).length;
  const canUploadMore = mediaItems.length + visibleExistingCount < MAX_IMAGES;

  useEffect(() => {
    return () => {
      mediaItems.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [mediaItems]);

  useEffect(() => {
    if (loading || !user) return;
    const fetchReview = async () => {
      const [{ data: review, error }, { data: images }] = await Promise.all([
        supabase
          .from("performance_reviews")
          .select("id,rating,content,user_id")
          .eq("id", reviewId)
          .eq("performance_id", performanceId)
          .single(),
        supabase
          .from("performance_review_images")
          .select("id,url")
          .eq("review_id", reviewId)
          .is("deleted_at", null),
      ]);

      if (error || !review) {
        toast("리뷰 정보를 불러오지 못했어요.");
        router.replace(`/performance/${performanceId}`);
        return;
      }

      if (review.user_id !== user.id) {
        toast("내 리뷰만 수정할 수 있어요.");
        router.replace(`/performance/${performanceId}`);
        return;
      }

      setRating(review.rating);
      setContent(review.content ?? "");
      setExistingImages((images ?? []) as ExistingImage[]);
      setFetching(false);
    };

    fetchReview();
  }, [reviewId, performanceId, loading, user, router]);

  const handleSelectFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    // 삭제 예정으로 표시한 기존 이미지는 개수에서 빼야 한다(visibleExistingCount).
    // existingImages.length를 쓰면 "기존 3장 중 2장 삭제 + 1장 추가"처럼 최종 2장이 되는
    // 정상 편집도 3장으로 계산돼 추가가 막힌다.
    if (
      file.size > MAX_IMAGE_SIZE ||
      mediaItems.length + visibleExistingCount >= MAX_IMAGES
    ) {
      event.target.value = "";
      return;
    }
    // 선택이 바뀌면 이전 업로드 결과는 더 이상 유효하지 않다(그대로 두면 저장 실패 후
    // 재시도할 때 바뀌기 전 사진이 링크된다).
    uploadedUrlsRef.current = null;
    setMediaItems((prev) =>
      [...prev, { file, url: URL.createObjectURL(file) }].slice(0, MAX_IMAGES)
    );
    event.target.value = "";
  };

  const handleRemoveNew = (index: number) => {
    sendHapticToApp();
    uploadedUrlsRef.current = null; // 위와 동일 — 선택 변경 시 업로드 캐시 무효화
    setMediaItems((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1);
      removed.forEach((item) => URL.revokeObjectURL(item.url));
      return next;
    });
  };

  const handleRemoveExisting = (imageId: string) => {
    sendHapticToApp();
    setRemovedImageIds((prev) => [...prev, imageId]);
  };

  const handleSubmit = async () => {
    if (!user) {
      openLoginSheet();
      return;
    }
    if (rating === 0) {
      toast("별점을 선택해 주세요.");
      return;
    }

    setSaving(true);
    const session = await ensureSessionOrLogin(openLoginSheet);
    if (!session) {
      setSaving(false);
      return;
    }
    const response = await fetch(`/api/reviews/${reviewId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rating,
        content: content.trim() ? content.trim() : null,
      }),
    });

    if (!response.ok) {
      toast("리뷰 수정에 실패했습니다.");
      setSaving(false);
      return;
    }

    const pendingRemovedIds = removedImageIds.filter(
      (imageId) => !appliedRemovedIdsRef.current.includes(imageId)
    );
    if (pendingRemovedIds.length > 0) {
      let deleteOk = false;
      try {
        const deleteResponse = await fetch(`/api/reviews/${reviewId}/images`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imageIds: pendingRemovedIds }),
        });
        deleteOk = deleteResponse.ok;
      } catch {
        deleteOk = false;
      }
      if (!deleteOk) {
        toast("이미지 삭제에 실패했습니다.");
        setSaving(false);
        return;
      }
      appliedRemovedIdsRef.current = [
        ...appliedRemovedIdsRef.current,
        ...pendingRemovedIds,
      ];
    }

    if (mediaItems.length > 0) {
      // 업로드 성공 URL은 재시도 간 재사용해 재업로드를 피한다(연결만 실패한 경우 대비).
      let uploadedUrls = uploadedUrlsRef.current;
      if (!uploadedUrls) {
        const uploadResults = await Promise.all(
          mediaItems.map(async (item) => {
            const compressed = await compressImage(item.file);
            const path = `${user.id}/performance-reviews/${reviewId}/${getSafeFileName(item.file)}`;
            const { error: uploadError } = await supabase.storage
              .from(BUCKET)
              .upload(path, compressed);
            if (uploadError) return null;
            const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
            return urlData.publicUrl;
          })
        );
        const succeeded = uploadResults.filter((url): url is string => Boolean(url));
        // 전체 실패 처리(all-or-nothing): 하나라도 업로드 실패하면 사진을 하나도 붙이지 않고
        // 재시도를 유도한다(성공분만 조용히 붙는 부분 저장을 피함). 본문·삭제는 이미 반영돼 있다.
        if (succeeded.length !== mediaItems.length) {
          setSaving(false);
          toast("사진을 첨부하지 못했어요. 다시 시도해 주세요.");
          return;
        }
        uploadedUrls = succeeded;
        uploadedUrlsRef.current = uploadedUrls;
      }

      if (uploadedUrls.length > 0) {
        // 이 연결(fetch)이 WKWebView에서 "Load failed"로 던질 수 있어 try/catch로 감싼다.
        // 응답을 확인하지 않으면 링크가 실패해도 저장 성공으로 착각한 채 화면을 벗어난다.
        let linkOk = false;
        try {
          const linkRes = await fetch(`/api/reviews/${reviewId}/images`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
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
    }

    // 성공 — 재시도용 보관값을 비운다.
    uploadedUrlsRef.current = null;
    appliedRemovedIdsRef.current = [];

    invalidatePerformanceHomeCache();
    invalidateDetailCache(performanceId);
    if (user) invalidateProfileCache(user.id);
    sessionStorage.setItem(`review-updated:${performanceId}`, "1");
    router.back();
  };

  if (loading || fetching) {
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
            로그인하면 리뷰를 수정할 수 있어요.
          </p>
          <Button
            type="button"
            className="h-11 w-full max-w-[240px] bg-[#17171c] text-white"
            onClick={openLoginSheet}
          >
            로그인하기
          </Button>
        </main>
      </MobileContainer>
    );
  }

  return (
    <MobileContainer>
      {saving ? <LoadingOverlay /> : null}
      <main className="px-4 pb-16">
        <PageHeader title="리뷰 수정" className="mb-5" />

        <div className="space-y-5">
          <section className="space-y-3">
            <Label className="text-sm text-[#17171c]/60">
              별점<span className="-ml-[1px] text-[#17171c]/50">*</span>
            </Label>
            <div className="flex items-center gap-2">
              {Array.from({ length: 5 }, (_, index) => {
                const starIndex = index + 1;
                const ratio = getStarFillRatio(rating, starIndex);
                return (
                  <div key={starIndex} className="relative h-7 w-7">
                    <Star className="h-6 w-6 text-brand" fill="none" />
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ width: `${ratio * 100}%` }}
                    >
                      <Star className="h-6 w-6 text-brand" fill="currentColor" />
                    </div>
                    <button
                      type="button"
                      className="absolute inset-0"
                      aria-label={`${starIndex * 2}점`}
                      onClick={() => { sendHapticToApp(); setRating(starIndex * 2); }}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-[#17171c]/60">내용</Label>
              <span className="text-xs text-[#17171c]/50">
                {content.length}/300
              </span>
            </div>
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="min-h-[200px] border-[#17171c]/5 bg-[#fafafa] text-base"
              maxLength={300}
            />
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-[#17171c]/60">미디어 업로드</Label>
              <span className="text-xs text-[#17171c]/50">
                {visibleExistingCount + mediaItems.length}/{MAX_IMAGES}
              </span>
            </div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 pr-2">
              <button
                type="button"
                className="relative aspect-square w-20 shrink-0 rounded-lg border border-dashed border-[#17171c]/10 bg-[#fafafa]"
                onClick={() => { sendHapticToApp(); if (canUploadMore) fileInputRef.current?.click(); }}
                aria-label="사진 추가"
                disabled={!canUploadMore}
              >
                <Plus className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-[#17171c]/40" />
              </button>
              {existingImages.filter((item) => !removedImageIds.includes(item.id)).map((item) => (
                <div
                  key={item.id}
                  className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-lg bg-white"
                >
                  <AnimatedImage
                    src={item.url}
                    alt="업로드 이미지"
                    width={80}
                    height={80}
                    sizes="80px"
                    draggable={false}
                    className="h-full w-full object-contain"
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-[#17171c] shadow-sm"
                    onClick={() => handleRemoveExisting(item.id)}
                    aria-label="사진 삭제"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {mediaItems.map((item, index) => (
                <div
                  key={`${item.url}-${index}`}
                  className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-lg bg-white"
                >
                  <AnimatedImage
                    src={item.url}
                    alt="업로드 이미지"
                    width={1600}
                    height={1600}
                    unoptimized
                    draggable={false}
                    className="h-full w-full object-contain"
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-[#17171c] shadow-sm"
                    onClick={() => handleRemoveNew(index)}
                    aria-label="사진 삭제"
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
              onChange={handleSelectFiles}
            />
            <p className="text-xs text-[#17171c]/50">
              사진은 최대 3장까지 업로드할 수 있어요.
            </p>
          </section>

          <Button
            type="button"
            className="h-12 w-full bg-[#17171c] text-white"
            onClick={handleSubmit}
            disabled={saving}
          >
            수정하기
          </Button>
        </div>
      </main>
    </MobileContainer>
  );
}

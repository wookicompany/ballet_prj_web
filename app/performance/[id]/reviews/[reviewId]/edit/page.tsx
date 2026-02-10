"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { ensureSessionOrLogin } from "@/lib/authSession";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft, Plus, Star, X } from "lucide-react";
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
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);

  const canUploadMore = mediaItems.length + existingImages.length < MAX_IMAGES;

  useEffect(() => {
    return () => {
      mediaItems.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [mediaItems]);

  useEffect(() => {
    const fetchReview = async () => {
      if (loading) return;
      if (!user) {
        openLoginSheet();
        return;
      }
      const { data: review, error } = await supabase
        .from("performance_reviews")
        .select("id,rating,content,user_id")
        .eq("id", reviewId)
        .eq("performance_id", performanceId)
        .single();

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

      const { data: images } = await supabase
        .from("performance_review_images")
        .select("id,url")
        .eq("review_id", reviewId);
      setExistingImages((images ?? []) as ExistingImage[]);
      setFetching(false);
    };

    fetchReview();
  }, [reviewId, performanceId, user, loading, openLoginSheet, router]);

  const handleSelectFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      file.size > MAX_IMAGE_SIZE ||
      mediaItems.length + existingImages.length >= MAX_IMAGES
    ) {
      event.target.value = "";
      return;
    }
    setMediaItems((prev) =>
      [...prev, { file, url: URL.createObjectURL(file) }].slice(0, MAX_IMAGES)
    );
    event.target.value = "";
  };

  const handleRemoveNew = (index: number) => {
    setMediaItems((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1);
      removed.forEach((item) => URL.revokeObjectURL(item.url));
      return next;
    });
  };

  const handleRemoveExisting = async (imageId: string) => {
    if (!user) {
      openLoginSheet();
      return;
    }
    const session = await ensureSessionOrLogin(openLoginSheet);
    if (!session) return;
    const response = await fetch(`/api/reviews/${reviewId}/images`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageIds: [imageId] }),
    });
    if (!response.ok) {
      toast("이미지를 삭제하지 못했어요.");
      return;
    }
    setExistingImages((prev) => prev.filter((item) => item.id !== imageId));
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

    if (mediaItems.length > 0) {
      const uploadedUrls: string[] = [];
      for (const item of mediaItems) {
        const path = `${user.id}/performance-reviews/${reviewId}/${getSafeFileName(
          item.file
        )}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, item.file);
        if (uploadError) {
          continue;
        }
        const { data: urlData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(path);
        uploadedUrls.push(urlData.publicUrl);
      }
      if (uploadedUrls.length > 0) {
        await fetch(`/api/reviews/${reviewId}/images`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ urls: uploadedUrls }),
        });
      }
    }

    router.replace(`/performance/${performanceId}`);
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
            className="h-11 w-full max-w-[240px] bg-[#17171c] text-white hover:bg-[#17171c]/90"
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
      <main className="px-4 pb-16 pt-6">
        <header className="mb-5 flex items-center justify-between">
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
          <h1 className="text-base font-semibold">리뷰 수정</h1>
          <div className="w-9" />
        </header>

        <div className="space-y-5">
          <section className="space-y-3">
            <Label className="text-xs text-[#17171c]/60">
              별점<span className="-ml-[1px] text-[#17171c]/50">*</span>
            </Label>
            <div className="flex items-center gap-2">
              {Array.from({ length: 5 }, (_, index) => {
                const starIndex = index + 1;
                const ratio = getStarFillRatio(rating, starIndex);
                return (
                  <div key={starIndex} className="relative h-7 w-7">
                    <Star className="h-6 w-6 text-[#ff273d]" fill="none" />
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ width: `${ratio * 100}%` }}
                    >
                      <Star className="h-6 w-6 text-[#ff273d]" fill="#ff273d" />
                    </div>
                    <button
                      type="button"
                      className="absolute inset-0"
                      aria-label={`${starIndex * 2}점`}
                      onClick={() => setRating(starIndex * 2)}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-[#17171c]/60">내용</Label>
              <span className="text-[11px] text-[#17171c]/50">
                {content.length}/300
              </span>
            </div>
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="min-h-[160px] border-black/5 bg-[#fafafa] text-sm"
              maxLength={300}
            />
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-[#17171c]/60">미디어 업로드</Label>
              <span className="text-[11px] text-[#17171c]/50">
                {existingImages.length + mediaItems.length}/{MAX_IMAGES}
              </span>
            </div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 pr-2">
              <button
                type="button"
                className="relative aspect-square w-20 shrink-0 rounded-lg border border-dashed border-black/10 bg-[#fafafa]"
                onClick={() => (canUploadMore ? fileInputRef.current?.click() : null)}
                aria-label="사진 추가"
                disabled={!canUploadMore}
              >
                <Plus className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-[#17171c]/40" />
              </button>
              {existingImages.map((item) => (
                <div
                  key={item.id}
                  className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-lg bg-white"
                >
                  <img
                    src={item.url}
                    alt="업로드 이미지"
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
                  <img
                    src={item.url}
                    alt="업로드 이미지"
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
            <p className="text-[11px] text-[#17171c]/50">
              사진은 최대 3장까지 업로드할 수 있어요.
            </p>
          </section>

          <Button
            type="button"
            className="h-12 w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
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

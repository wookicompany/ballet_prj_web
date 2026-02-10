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

type PreviewItem = {
  file: File;
  url: string;
};

export default function PerformanceReviewNewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const performanceId = params.id;
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [mediaItems, setMediaItems] = useState<PreviewItem[]>([]);
  const [saving, setSaving] = useState(false);

  const canUploadMore = mediaItems.length < MAX_IMAGES;

  useEffect(() => {
    return () => {
      mediaItems.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [mediaItems]);

  const handleSelectFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE || mediaItems.length >= MAX_IMAGES) {
      event.target.value = "";
      return;
    }
    setMediaItems((prev) =>
      [...prev, { file, url: URL.createObjectURL(file) }].slice(0, MAX_IMAGES)
    );
    event.target.value = "";
  };

  const handleRemove = (index: number) => {
    setMediaItems((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1);
      removed.forEach((item) => URL.revokeObjectURL(item.url));
      return next;
    });
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
    const { data, error } = await supabase
      .from("performance_reviews")
      .insert({
        performance_id: performanceId,
        user_id: user.id,
        rating,
        content: content.trim() ? content.trim() : null,
      })
      .select("id")
      .single();

    if (error || !data) {
      toast("리뷰 저장에 실패했습니다.");
      setSaving(false);
      return;
    }

    if (mediaItems.length > 0) {
      for (const item of mediaItems) {
        const path = `${user.id}/performance-reviews/${data.id}/${getSafeFileName(
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
        await supabase.from("performance_review_images").insert({
          review_id: data.id,
          user_id: user.id,
          url: urlData.publicUrl,
        });
      }
    }

    router.replace(`/performance/${performanceId}/reviews/${data.id}`);
  };


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
          <p className="text-sm text-[#17171c]/70">
            로그인하면 리뷰를 작성할 수 있어요.
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
          <h1 className="text-base font-semibold">리뷰 작성</h1>
          <div className="w-9" />
        </header>

        <div className="space-y-8">
          <section className="space-y-3">
            <Label className="text-xs text-[#17171c]/60">별점</Label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="rounded-full p-1"
                  aria-label={`${value}점`}
                  onClick={() => setRating(value)}
                >
                  <Star
                    className={`h-6 w-6 ${
                      value <= rating ? "text-[#ff273d]" : "text-[#17171c]/20"
                    }`}
                    fill={value <= rating ? "#ff273d" : "none"}
                  />
                </button>
              ))}
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
              className="min-h-[140px] text-sm"
              maxLength={300}
            />
          </section>

          <section className="space-y-3">
            <Label className="text-xs text-[#17171c]/60">미디어 업로드</Label>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 pr-2">
              <button
                type="button"
                className="relative aspect-square w-20 shrink-0 rounded-lg border border-dashed border-black/10 bg-transparent"
                onClick={() => (canUploadMore ? fileInputRef.current?.click() : null)}
                aria-label="사진 추가"
                disabled={!canUploadMore}
              >
                <Plus className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-[#17171c]/40" />
              </button>
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
                    onClick={() => handleRemove(index)}
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
            등록하기
          </Button>
        </div>
      </main>
    </MobileContainer>
  );
}

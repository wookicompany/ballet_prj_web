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
  // 사진 연결(fetch)이 실패했을 때 화면에 머물며 재시도할 수 있도록, 이미 만든 리뷰 id와
  // 업로드에 성공한 URL을 보관한다. '등록'을 다시 누르면 리뷰를 중복 생성하거나 재업로드하지
  // 않고 사진 연결만 다시 시도한다. 성공하면 둘 다 비운다.
  const createdReviewIdRef = useRef<string | null>(null);
  const uploadedUrlsRef = useRef<string[] | null>(null);

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
    sendHapticToApp();
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
    const session = await ensureSessionOrLogin(openLoginSheet);
    if (!session) {
      setSaving(false);
      return;
    }

    // 이전 시도에서 리뷰는 이미 만들어졌고 사진 연결만 실패했다면, 리뷰를 다시 만들지 않는다.
    let reviewId = createdReviewIdRef.current;
    if (!reviewId) {
      let response: Response;
      try {
        response = await fetch("/api/reviews", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            performance_id: performanceId,
            rating,
            content: content.trim() ? content.trim() : null,
          }),
        });
      } catch {
        setSaving(false);
        toast("네트워크 연결을 확인하고 다시 시도해 주세요.");
        return;
      }

      if (!response.ok) {
        toast("리뷰 저장에 실패했습니다.");
        setSaving(false);
        return;
      }
      const payload = (await response.json()) as { id?: string };
      if (!payload.id) {
        toast("리뷰 저장에 실패했습니다.");
        setSaving(false);
        return;
      }
      reviewId = payload.id;
      createdReviewIdRef.current = reviewId;
    } else {
      // 재시도: 리뷰는 이미 있으므로, 그 사이 사용자가 별점이나 내용을 바꿨을 수 있어 PATCH로
      // 동기화한 뒤 사진 연결을 재시도한다(변경이 조용히 무시되는 것을 막는다). 사진 세트 변경은
      // 재사용하는 업로드 URL을 그대로 쓰므로 원래 사진이 유지된다.
      let patchResponse: Response;
      try {
        patchResponse = await fetch(`/api/reviews/${reviewId}`, {
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
      } catch {
        setSaving(false);
        toast("네트워크 연결을 확인하고 다시 시도해 주세요.");
        return;
      }
      if (!patchResponse.ok) {
        toast("리뷰 저장에 실패했습니다.");
        setSaving(false);
        return;
      }
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
        // 재시도를 유도한다(성공분만 조용히 붙는 부분 저장을 피함). 리뷰 본문은 이미 저장돼 있다.
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
        // 실패해도 리뷰 본문은 이미 저장된 상태이므로, 화면에 머물며 '등록' 재탭으로 재시도하게
        // 안내한다(자동 재시도 없음 — 사용자가 직접 재시도).
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

    // 성공 — 재시도용 보관값을 비우고 이동한다.
    createdReviewIdRef.current = null;
    uploadedUrlsRef.current = null;
    invalidatePerformanceHomeCache();
    invalidateDetailCache(performanceId);
    if (user) invalidateProfileCache(user.id);
    sessionStorage.setItem(`review-created:${performanceId}`, "1");
    router.back();
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      openLoginSheet();
    }
  }, [user, loading, openLoginSheet]);

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
        <PageHeader title="리뷰 작성" className="mb-5" />

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
                      onClick={() => {
                        sendHapticToApp();
                        setRating(starIndex * 2);
                      }}
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
                {mediaItems.length}/{MAX_IMAGES}
              </span>
            </div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 pr-2">
              <button
                type="button"
                className="relative aspect-square w-20 shrink-0 rounded-md border border-dashed border-[#17171c]/10 bg-[#fafafa]"
                onClick={() => { sendHapticToApp(); if (canUploadMore) fileInputRef.current?.click(); }}
                aria-label="사진 추가"
                disabled={!canUploadMore}
              >
                <Plus className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-[#17171c]/40" />
              </button>
              {mediaItems.map((item, index) => (
                <div
                  key={`${item.url}-${index}`}
                  className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-md border border-[#17171c]/5 bg-white"
                >
                  <AnimatedImage
                    src={item.url}
                    alt="업로드 이미지"
                    width={1600}
                    height={1600}
                    unoptimized
                    draggable={false}
                    className="h-full w-full object-cover"
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
            등록하기
          </Button>
        </div>
      </main>
    </MobileContainer>
  );
}

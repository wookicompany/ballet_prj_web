"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import LoadingOverlay from "@/components/ui/loading-overlay";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export default function PerformanceReviewCommentNewPage() {
  const router = useRouter();
  const params = useParams<{ id: string; reviewId: string }>();
  const performanceId = params.id;
  const reviewId = params.reviewId;
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();

  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      openLoginSheet();
      return;
    }
    if (!content.trim()) {
      toast("댓글 내용을 입력해 주세요.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("performance_review_comments").insert({
      review_id: reviewId,
      user_id: user.id,
      content: content.trim(),
    });

    if (error) {
      toast("댓글 등록에 실패했습니다.");
      setSaving(false);
      return;
    }

    router.replace(
      `/performance/${performanceId}/reviews/${reviewId}/comments`
    );
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
            로그인하면 댓글을 작성할 수 있어요.
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
          <h1 className="text-base font-semibold">댓글 작성</h1>
          <div className="w-9" />
        </header>

        <div className="space-y-6">
          <section className="space-y-3">
            <Label className="text-xs text-[#17171c]/60">댓글</Label>
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="댓글을 입력해 주세요."
              className="min-h-[140px]"
            />
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

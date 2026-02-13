"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export default function SupportPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (loading) return;
    if (!user) {
      openLoginSheet();
      return;
    }
    if (!title.trim() || !content.trim()) {
      toast("제목과 내용을 입력해 주세요.");
      return;
    }
    setSending(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", user.id)
        .single();

      const { error } = await supabase.from("support_inquiries").insert({
        user_id: user.id,
        email: user.email ?? null,
        nickname: profile?.nickname ?? null,
        title: title.trim(),
        content: content.trim(),
      });

      if (error) {
        toast("문의 전송에 실패했습니다.");
        return;
      }

      toast("문의가 접수되었어요.");
      router.back();
    } finally {
      setSending(false);
    }
  };

  const isDisabled = !title.trim() || !content.trim() || sending;

  return (
    <MobileContainer>
      {sending ? <LoadingOverlay /> : null}
      <main className="px-4 pb-12 pt-2">
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
          <h1 className="text-base font-semibold">문의하기</h1>
          <div className="w-9" />
        </header>

        <div className="space-y-6">
          <section className="space-y-2">
            <Label className="text-xs text-[#17171c]/60">제목</Label>
            <Input
              className="placeholder:text-xs"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={50}
              placeholder="문의 제목을 입력해 주세요."
            />
          </section>

          <section className="space-y-2">
            <Label className="text-xs text-[#17171c]/60">내용</Label>
            <Textarea
              className="placeholder:text-xs"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={6}
              placeholder="문의 내용을 입력해 주세요."
            />
          </section>

          <Button
            type="button"
            className="h-12 w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
            disabled={isDisabled}
            onClick={handleSubmit}
          >
            문의하기
          </Button>
        </div>
      </main>
    </MobileContainer>
  );
}

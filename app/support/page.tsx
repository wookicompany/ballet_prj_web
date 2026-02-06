"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft } from "lucide-react";

export default function SupportPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    setSending(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setSending(false);
    router.back();
  };

  const isDisabled = !title.trim() || !content.trim() || sending;

  return (
    <MobileContainer>
      <main className="px-4 pb-12 pt-6">
        <header className="mb-6 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-[#17171c]/70"
            onClick={() => router.back()}
            aria-label="뒤로"
          >
            <ChevronLeft className="h-5 w-5" />
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
            {sending ? "보내는 중..." : "문의하기"}
          </Button>
        </div>
      </main>
    </MobileContainer>
  );
}

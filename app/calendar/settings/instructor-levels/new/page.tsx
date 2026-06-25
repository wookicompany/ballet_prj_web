"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { getAccessToken } from "@/lib/authSession";
import { invalidateInstructorLevelsCache } from "@/lib/instructorLevelsCache";
import { toast } from "sonner";

export default function NewInstructorLevelPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [form, setForm] = useState({ instructor: "", level: "" });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    if (!form.instructor.trim() || !form.level.trim()) {
      toast("강사님과 레벨을 모두 입력해 주세요.");
      return;
    }
    setSaving(true);
    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) {
      setSaving(false);
      return;
    }
    const response = await fetch("/api/saved-instructor-levels", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instructor: form.instructor.trim(),
        level: form.level.trim(),
      }),
    });
    if (!response.ok) {
      setSaving(false);
      toast("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    invalidateInstructorLevelsCache();
    router.back();
  };

  if (!loading && !user) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-[#17171c]/70">
            로그인이 필요한 화면이에요.
          </p>
          <Button
            type="button"
            className="bg-[#17171c] text-white"
            onClick={openLoginSheet}
          >
            로그인하고 계속하기
          </Button>
        </main>
      </MobileContainer>
    );
  }

  return (
    <MobileContainer>
      <main className="flex min-h-screen flex-col px-4 pb-8">
        <PageHeader title="강사님 & 레벨 추가" className="mb-6" />

        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm text-[#17171c]/60">강사님</Label>
            <Input
              className="h-12 text-base placeholder:text-sm"
              placeholder="예: 김선생님"
              value={form.instructor}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  instructor: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-[#17171c]/60">레벨</Label>
            <Input
              className="h-12 text-base placeholder:text-sm"
              placeholder="예: 초급"
              value={form.level}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, level: event.target.value }))
              }
            />
          </div>
        </div>

        <div className="mt-6">
          <Button
            type="button"
            className="h-12 w-full bg-[#17171c] text-white"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? <Spinner size="sm" className="text-white" /> : "저장하기"}
          </Button>
        </div>
      </main>
    </MobileContainer>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { getAccessToken } from "@/lib/authSession";
import { invalidateLocationsCache } from "@/lib/locationsCache";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export default function NewLocationPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [form, setForm] = useState({
    name: "",
    address_base: "",
    address_detail: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    if (!form.name.trim()) {
      toast("장소 이름을 입력해 주세요.");
      return;
    }
    setSaving(true);
    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) {
      setSaving(false);
      return;
    }
    const response = await fetch("/api/saved-locations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: form.name.trim(),
        address_base: form.address_base.trim(),
        address_detail: form.address_detail.trim(),
      }),
    });
    if (!response.ok) {
      setSaving(false);
      toast("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    invalidateLocationsCache();
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
        <header className="sticky top-0 z-20 bg-white h-12 mb-6 flex items-center justify-between">
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
          <h1 className="text-base font-semibold">장소 추가</h1>
          <div className="w-10" />
        </header>

        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm text-[#17171c]/60">장소</Label>
            <Input
              className="h-12 text-base placeholder:text-sm"
              placeholder="장소 이름을 입력해 주세요"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-[#17171c]/60">주소</Label>
            <Input
              className="h-12 text-base placeholder:text-sm"
              placeholder="주소를 입력해 주세요"
              value={form.address_base}
              onChange={(event) =>
                setForm((prev) => {
                  const nextAddress = event.target.value;
                  return {
                    ...prev,
                    address_base: nextAddress,
                    address_detail:
                      nextAddress !== prev.address_base
                        ? ""
                        : prev.address_detail,
                  };
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-[#17171c]/60">상세 주소</Label>
            <Input
              className="h-12 text-base placeholder:text-sm"
              placeholder="상세 주소를 입력해 주세요 (선택사항)"
              value={form.address_detail}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  address_detail: event.target.value,
                }))
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

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { getAccessToken } from "@/lib/authSession";
import { getProfileCache, invalidateProfileCache } from "@/lib/profileCache";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

type ProfileCachePayload = {
  profile: { favorite_dancer_1: string | null; favorite_dancer_2: string | null } | null;
};

export default function DancersPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [dancer1, setDancer1] = useState("");
  const [dancer2, setDancer2] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadDancers = useCallback(async () => {
    if (!user) return;

    const cached = getProfileCache<ProfileCachePayload>(user.id);
    if (cached?.profile !== undefined) {
      setDancer1(cached.profile?.favorite_dancer_1 ?? "");
      setDancer2(cached.profile?.favorite_dancer_2 ?? "");
      setPageLoading(false);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("favorite_dancer_1,favorite_dancer_2")
      .eq("id", user.id)
      .single();

    setDancer1(data?.favorite_dancer_1 ?? "");
    setDancer2(data?.favorite_dancer_2 ?? "");
    setPageLoading(false);
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setPageLoading(false);
      return;
    }
    void loadDancers();
  }, [loading, loadDancers, user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) {
      setSaving(false);
      return;
    }

    let response: Response;
    try {
      response = await fetch("/api/profile/dancers", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          favorite_dancer_1: dancer1.trim() || null,
          favorite_dancer_2: dancer2.trim() || null,
        }),
      });
    } catch {
      setSaving(false);
      toast("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setSaving(false);

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      toast(data.message ?? "저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    invalidateProfileCache(user.id);
    toast("저장되었어요.");
    router.back();
  };

  if (!loading && !user) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-[#17171c]/70">로그인이 필요한 화면이에요.</p>
          <Button type="button" className="bg-[#17171c] text-white" onClick={openLoginSheet}>
            로그인하고 계속하기
          </Button>
        </main>
      </MobileContainer>
    );
  }

  return (
    <MobileContainer>
      <main className="px-4 pb-16">
        <PageHeader title="무용수 관리" className="mb-6" />

        {pageLoading ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dancer1" className="text-sm text-[#17171c]">
                무용수 1
              </Label>
              <Input
                id="dancer1"
                className="h-9"
                placeholder="무용수 이름을 입력해 주세요"
                value={dancer1}
                maxLength={20}
                onChange={(e) => setDancer1(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dancer2" className="text-sm text-[#17171c]">
                무용수 2
              </Label>
              <Input
                id="dancer2"
                className="h-9"
                placeholder="무용수 이름을 입력해 주세요"
                value={dancer2}
                maxLength={20}
                onChange={(e) => setDancer2(e.target.value)}
              />
            </div>
            <p className="text-xs text-[#17171c]/50">
              공연 탭에서 해당 무용수의 공연을 보여드려요.
            </p>
          </div>
        )}

        <Button
          type="button"
          className="mt-8 w-full bg-[#17171c] text-white"
          disabled={saving || pageLoading}
          onClick={handleSave}
        >
          {saving ? <Spinner size="sm" className="text-white" /> : "저장하기"}
        </Button>
      </main>
    </MobileContainer>
  );
}

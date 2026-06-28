"use client";

import { useCallback, useEffect, useState } from "react";

import MobileContainer from "@/components/layout/MobileContainer";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getAccessToken } from "@/lib/authSession";
import { getProfileCache, invalidateProfileCache } from "@/lib/profileCache";
import { supabase } from "@/lib/supabaseClient";
import { Check, Heart, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

type Slot = "1" | "2";
type ProfileCachePayload = {
  profile: { favorite_dancer_1: string | null; favorite_dancer_2: string | null } | null;
};

export default function DancersPage() {
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [dancer1, setDancer1] = useState<string | null>(null);
  const [dancer2, setDancer2] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [editingSlot, setEditingSlot] = useState<Slot | "new" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [mutating, setMutating] = useState(false);

  const loadDancers = useCallback(async () => {
    if (!user) return;
    const cached = getProfileCache<ProfileCachePayload>(user.id);
    if (cached?.profile !== undefined) {
      setDancer1(cached.profile?.favorite_dancer_1 ?? null);
      setDancer2(cached.profile?.favorite_dancer_2 ?? null);
      setPageLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("favorite_dancer_1,favorite_dancer_2")
      .eq("id", user.id)
      .single();
    setDancer1(data?.favorite_dancer_1 ?? null);
    setDancer2(data?.favorite_dancer_2 ?? null);
    setPageLoading(false);
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (!user) { setPageLoading(false); return; }
    void loadDancers();
  }, [loading, loadDancers, user]);

  const callPatch = useCallback(
    async (payload: { favorite_dancer_1?: string | null; favorite_dancer_2?: string | null }) => {
      if (!user) return false;
      const accessToken = await getAccessToken(openLoginSheet);
      if (!accessToken) return false;
      let response: Response;
      try {
        response = await fetch("/api/profile/dancers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(payload),
        });
      } catch {
        toast("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return false;
      }
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        toast(data.message ?? "저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return false;
      }
      invalidateProfileCache(user.id);
      return true;
    },
    [openLoginSheet, user]
  );

  const handleDelete = async (slot: Slot) => {
    if (!user || mutating) return;
    setMutating(true);
    const ok = await callPatch(slot === "1" ? { favorite_dancer_1: null } : { favorite_dancer_2: null });
    if (ok) {
      if (slot === "1") setDancer1(null);
      else setDancer2(null);
    }
    setMutating(false);
  };

  const handleEditSave = async () => {
    if (!user || mutating || !editingSlot) return;
    const trimmed = editValue.trim();
    if (!trimmed) {
      toast("무용수 이름을 입력해 주세요.");
      return;
    }
    setMutating(true);
    if (editingSlot === "new") {
      if (!dancer1) {
        const ok = await callPatch({ favorite_dancer_1: trimmed });
        if (ok) { setDancer1(trimmed); setEditingSlot(null); }
      } else {
        const ok = await callPatch({ favorite_dancer_2: trimmed });
        if (ok) { setDancer2(trimmed); setEditingSlot(null); }
      }
    } else if (editingSlot === "1") {
      const ok = await callPatch({ favorite_dancer_1: trimmed });
      if (ok) { setDancer1(trimmed); setEditingSlot(null); }
    } else {
      const ok = await callPatch({ favorite_dancer_2: trimmed });
      if (ok) { setDancer2(trimmed); setEditingSlot(null); }
    }
    setMutating(false);
  };

  const handleEditCancel = () => {
    setEditingSlot(null);
    setEditValue("");
  };

  const filledCount = [dancer1, dancer2].filter(Boolean).length;
  const canAdd = filledCount < 2;

  const renderCard = (name: string, slot: Slot) => {
    if (editingSlot === slot) {
      return (
        <div key={slot} className="rounded-xl border border-[#17171c]/5 bg-white px-4 py-4">
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              className="h-9 flex-1"
              value={editValue}
              maxLength={20}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleEditSave();
                if (e.key === "Escape") handleEditCancel();
              }}
            />
            <Button
              type="button" variant="ghost" size="icon"
              className="h-8 w-8 text-[#17171c]/70"
              disabled={mutating}
              onClick={handleEditSave}
              aria-label="저장"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              type="button" variant="ghost" size="icon"
              className="h-8 w-8 text-[#17171c]/40"
              onClick={handleEditCancel}
              aria-label="취소"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div key={slot} className="rounded-xl border border-[#17171c]/5 bg-white px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-[#17171c]">
            <Heart className="h-4 w-4 text-[#17171c]/50" />
            {name}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button" variant="ghost" size="icon"
              className="h-8 w-8 text-[#17171c]/70"
              disabled={mutating}
              onClick={() => { setEditValue(name); setEditingSlot(slot); }}
              aria-label="수정"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button" variant="ghost" size="icon"
              className="h-8 w-8 text-[#17171c]/70"
              disabled={mutating}
              onClick={() => handleDelete(slot)}
              aria-label="삭제"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderNewCard = () => (
    <div className="rounded-xl border border-[#17171c]/5 bg-white px-4 py-4">
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          className="h-9 flex-1"
          placeholder="무용수 이름을 입력해 주세요"
          value={editValue}
          maxLength={20}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleEditSave();
            if (e.key === "Escape") handleEditCancel();
          }}
        />
        <Button
          type="button" variant="ghost" size="icon"
          className="h-8 w-8 text-[#17171c]/70"
          disabled={mutating}
          onClick={handleEditSave}
          aria-label="저장"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          type="button" variant="ghost" size="icon"
          className="h-8 w-8 text-[#17171c]/40"
          onClick={handleEditCancel}
          aria-label="취소"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

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
        <PageHeader
          title="무용수 관리"
          className="mb-6"
          right={
            canAdd && editingSlot !== "new" && !pageLoading ? (
              <Button
                type="button" variant="ghost" size="icon-lg"
                className="text-[#17171c]/70"
                disabled={mutating}
                onClick={() => { setEditValue(""); setEditingSlot("new"); }}
                aria-label="무용수 추가"
              >
                <Plus className="size-5" />
              </Button>
            ) : undefined
          }
        />

        <section className="space-y-3">
          {pageLoading ? (
            <>
              <Skeleton className="h-[56px] w-full rounded-xl" />
              <Skeleton className="h-[56px] w-full rounded-xl" />
            </>
          ) : (
            <>
              {dancer1 && renderCard(dancer1, "1")}
              {dancer2 && renderCard(dancer2, "2")}
              {editingSlot === "new" && renderNewCard()}
              {!dancer1 && !dancer2 && editingSlot !== "new" && (
                <div className="rounded-xl border border-[#17171c]/5 bg-white px-4 py-6 text-center">
                  <p className="text-sm text-[#17171c]/70">저장된 무용수가 아직 없어요.</p>
                </div>
              )}
            </>
          )}
        </section>

        {!pageLoading && (
          <p className="mt-4 px-1 text-xs text-[#17171c]/50">
            공연 탭에서 해당 무용수의 공연을 모아서 보여드려요.
          </p>
        )}
      </main>
    </MobileContainer>
  );
}

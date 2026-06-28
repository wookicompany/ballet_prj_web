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
import { supabase } from "@/lib/supabaseClient";
import { Check, Heart, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

type Dancer = { id: string; name: string };

export default function DancersPage() {
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [dancers, setDancers] = useState<Dancer[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [mutating, setMutating] = useState(false);

  const loadDancers = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("favorite_dancers")
      .select("id, name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    setDancers(data ?? []);
    setPageLoading(false);
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (!user) { setPageLoading(false); return; }
    void loadDancers();
  }, [loading, loadDancers, user]);

  const handleAdd = async () => {
    if (!user || mutating) return;
    const trimmed = editValue.trim();
    if (!trimmed) { toast("무용수 이름을 입력해 주세요."); return; }
    setMutating(true);
    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) { setMutating(false); return; }
    try {
      const res = await fetch("/api/profile/dancers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        toast(d.message ?? "저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      } else {
        const d = (await res.json()) as { item: Dancer };
        setDancers((prev) => [...prev, d.item]);
        setEditingId(null);
        setEditValue("");
      }
    } catch {
      toast("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
    }
    setMutating(false);
  };

  const handleEditSave = async (id: string) => {
    if (!user || mutating) return;
    const trimmed = editValue.trim();
    if (!trimmed) { toast("무용수 이름을 입력해 주세요."); return; }
    setMutating(true);
    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) { setMutating(false); return; }
    try {
      const res = await fetch(`/api/profile/dancers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        toast(d.message ?? "저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      } else {
        setDancers((prev) => prev.map((d) => d.id === id ? { ...d, name: trimmed } : d));
        setEditingId(null);
        setEditValue("");
      }
    } catch {
      toast("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
    }
    setMutating(false);
  };

  const handleDelete = async (id: string) => {
    if (!user || mutating) return;
    setMutating(true);
    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) { setMutating(false); return; }
    try {
      const res = await fetch(`/api/profile/dancers/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        toast(d.message ?? "삭제에 실패했어요. 잠시 후 다시 시도해 주세요.");
      } else {
        setDancers((prev) => prev.filter((d) => d.id !== id));
      }
    } catch {
      toast("삭제에 실패했어요. 잠시 후 다시 시도해 주세요.");
    }
    setMutating(false);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditValue("");
  };

  const renderCard = (dancer: Dancer) => {
    if (editingId === dancer.id) {
      return (
        <div key={dancer.id} className="rounded-xl border border-[#17171c]/5 bg-white px-4 py-4">
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              className="h-9 flex-1"
              value={editValue}
              maxLength={20}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleEditSave(dancer.id);
                if (e.key === "Escape") handleEditCancel();
              }}
            />
            <Button
              type="button" variant="ghost" size="icon"
              className="h-8 w-8 text-[#17171c]/70"
              disabled={mutating}
              onClick={() => handleEditSave(dancer.id)}
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
      <div key={dancer.id} className="rounded-xl border border-[#17171c]/5 bg-white px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-[#17171c]">
            <Heart className="h-4 w-4 text-[#17171c]/50" />
            {dancer.name}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button" variant="ghost" size="icon"
              className="h-8 w-8 text-[#17171c]/70"
              disabled={mutating}
              onClick={() => { setEditValue(dancer.name); setEditingId(dancer.id); }}
              aria-label="수정"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button" variant="ghost" size="icon"
              className="h-8 w-8 text-[#17171c]/70"
              disabled={mutating}
              onClick={() => handleDelete(dancer.id)}
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
            if (e.key === "Enter") void handleAdd();
            if (e.key === "Escape") handleEditCancel();
          }}
        />
        <Button
          type="button" variant="ghost" size="icon"
          className="h-8 w-8 text-[#17171c]/70"
          disabled={mutating}
          onClick={handleAdd}
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
            editingId !== "new" && !pageLoading ? (
              <Button
                type="button" variant="ghost" size="icon-lg"
                className="text-[#17171c]/70"
                disabled={mutating}
                onClick={() => { setEditValue(""); setEditingId("new"); }}
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
              {dancers.map((dancer) => renderCard(dancer))}
              {editingId === "new" && renderNewCard()}
              {dancers.length === 0 && editingId !== "new" && (
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

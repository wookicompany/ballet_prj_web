"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import BottomSheet from "@/components/sheets/BottomSheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { getAccessToken } from "@/lib/authSession";
import { ChevronLeft, Layers, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

type SavedInstructorLevel = {
  id: string;
  instructor: string;
  level: string;
};

export default function SavedInstructorLevelsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [items, setItems] = useState<SavedInstructorLevel[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ instructor: "", level: "" });
  const [deleteTarget, setDeleteTarget] =
    useState<SavedInstructorLevel | null>(null);

  const resetForm = () => {
    setForm({ instructor: "", level: "" });
    setEditingId(null);
  };

  const fetchItems = useCallback(async () => {
    if (!user) return;
    setListLoading(true);
    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) {
      setListLoading(false);
      return;
    }
    const response = await fetch("/api/saved-instructor-levels", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      setListLoading(false);
      toast("저장된 강사님 & 레벨을 불러오지 못했어요.");
      return;
    }
    const payload = (await response.json()) as {
      items: SavedInstructorLevel[];
    };
    setItems(payload.items ?? []);
    setListLoading(false);
  }, [openLoginSheet, user]);

  useEffect(() => {
    if (!user) return;
    void fetchItems();
  }, [fetchItems, user]);

  const handleOpenCreate = () => {
    resetForm();
    setSheetOpen(true);
  };

  const handleOpenEdit = (item: SavedInstructorLevel) => {
    setEditingId(item.id);
    setForm({ instructor: item.instructor, level: item.level });
    setSheetOpen(true);
  };

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
    const response = await fetch(
      editingId
        ? `/api/saved-instructor-levels/${editingId}`
        : "/api/saved-instructor-levels",
      {
        method: editingId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instructor: form.instructor.trim(),
          level: form.level.trim(),
        }),
      }
    );
    if (!response.ok) {
      setSaving(false);
      toast("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    await fetchItems();
    setSaving(false);
    setSheetOpen(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (!user || !deleteTarget) return;
    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) return;
    const response = await fetch(
      `/api/saved-instructor-levels/${deleteTarget.id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    if (!response.ok) {
      toast("삭제에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setDeleteTarget(null);
    await fetchItems();
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
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-[#17171c]/70">
            로그인이 필요한 화면이에요.
          </p>
          <Button
            type="button"
            className="bg-[#17171c] text-white hover:bg-[#17171c]/90"
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
      <main className="px-4 pb-16 pt-2">
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
          <h1 className="text-base font-semibold">강사님 & 레벨 관리</h1>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="text-[#17171c]/70"
            onClick={handleOpenCreate}
            aria-label="강사님 & 레벨 추가"
          >
            <Plus className="size-5" />
          </Button>
        </header>

        <section className="space-y-3">
          {listLoading ? (
            <div className="flex min-h-[160px] items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-black/5 bg-white px-4 py-6 text-center">
              <p className="text-sm text-[#17171c]/70">
                저장된 강사님 & 레벨이 아직 없어요.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-black/5 bg-white px-4 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-[#17171c]">
                      <UserRound className="h-4 w-4 text-[#17171c]/50" />
                      {item.instructor}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#17171c]/60">
                      <Layers className="h-3.5 w-3.5" />
                      {item.level}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-[#17171c]/70"
                      onClick={() => handleOpenEdit(item)}
                      aria-label="강사님 & 레벨 수정"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-[#17171c]/70"
                      onClick={() => setDeleteTarget(item)}
                      aria-label="강사님 & 레벨 삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      </main>

      <BottomSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) resetForm();
        }}
      >
        <div className="space-y-4">
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
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1"
              onClick={() => setSheetOpen(false)}
              disabled={saving}
            >
              취소
            </Button>
            <Button
              type="button"
              className="h-12 flex-1 bg-[#17171c] text-white hover:bg-[#17171c]/90"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "저장 중..." : "저장하기"}
            </Button>
          </div>
        </div>
      </BottomSheet>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 목록을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              삭제하면 기록 작성에서 불러올 수 없어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row gap-2">
            <AlertDialogCancel className="flex-1">취소</AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              className="flex-1 text-red-500 hover:text-red-500"
              onClick={async () => {
                await handleDelete();
              }}
            >
              삭제할게요
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MobileContainer>
  );
}

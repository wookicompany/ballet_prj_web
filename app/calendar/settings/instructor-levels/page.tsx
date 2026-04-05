"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
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
import { Skeleton } from "@/components/ui/skeleton";
import { getAccessToken } from "@/lib/authSession";
import {
  getInstructorLevelsCache,
  setInstructorLevelsCache,
  invalidateInstructorLevelsCache,
} from "@/lib/instructorLevelsCache";
import { ChevronLeft, Layers, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

type SavedInstructorLevel = {
  id: string;
  instructor: string;
  level: string;
};

function InstructorLevelListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={`instructor-level-skeleton-${index}`}
          className="rounded-xl border border-[#17171c]/5 bg-white px-4 py-4"
        >
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

type InstructorLevelsCachePayload = { items: SavedInstructorLevel[] };

export default function SavedInstructorLevelsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const cached = getInstructorLevelsCache<InstructorLevelsCachePayload>();
  const [items, setItems] = useState<SavedInstructorLevel[]>(() => cached?.items ?? []);
  const [listLoading, setListLoading] = useState(() => !cached);
  const [deleteTarget, setDeleteTarget] =
    useState<SavedInstructorLevel | null>(null);

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
    setInstructorLevelsCache<InstructorLevelsCachePayload>({ items: payload.items ?? [] });
    setListLoading(false);
  }, [openLoginSheet, user]);

  useEffect(() => {
    if (!user) return;
    if (getInstructorLevelsCache<InstructorLevelsCachePayload>()) return;
    void fetchItems();
  }, [fetchItems, user]);

  const handleDelete = async () => {
    if (!user || !deleteTarget) return;
    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) return;
    const targetId = deleteTarget.id;
    const response = await fetch(
      `/api/saved-instructor-levels/${targetId}`,
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
    setItems((prev) => prev.filter((i) => i.id !== targetId));
    invalidateInstructorLevelsCache();
    setDeleteTarget(null);
  };

  const renderedItems = useMemo(
    () =>
      items.map((item) => (
        <div
          key={item.id}
          className="rounded-xl border border-[#17171c]/5 bg-white px-4 py-4"
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
                onClick={() =>
                  router.push(
                    `/calendar/settings/instructor-levels/${item.id}/edit`
                  )
                }
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
      )),
    [items, router]
  );

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
      <main className="px-4 pb-16">
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
          <h1 className="text-base font-semibold">강사님 & 레벨 관리</h1>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="text-[#17171c]/70"
            onClick={() =>
              router.push("/calendar/settings/instructor-levels/new")
            }
            disabled={loading}
            aria-label="강사님 & 레벨 추가"
          >
            <Plus className="size-5" />
          </Button>
        </header>

        <section className="space-y-3">
          {loading || listLoading ? (
            <InstructorLevelListSkeleton />
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-[#17171c]/5 bg-white px-4 py-6 text-center">
              <p className="text-sm text-[#17171c]/70">
                저장된 강사님 & 레벨이 아직 없어요.
              </p>
            </div>
          ) : (
            renderedItems
          )}
        </section>
      </main>

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

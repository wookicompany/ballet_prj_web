"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { getAccessToken } from "@/lib/authSession";
import { BAR_ORDER_TAGS } from "@/lib/orderTags";
import { ChevronLeft, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type SavedBarOrder = {
  id: string;
  name: string;
  order_text: string;
};

export default function SavedBarOrdersPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [items, setItems] = useState<SavedBarOrder[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "" });
  const [orderTags, setOrderTags] = useState<string[]>([]);
  const [orderInput, setOrderInput] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SavedBarOrder | null>(null);

  const renderListSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={`bar-order-skeleton-${index}`}
          className="rounded-xl border border-black/5 bg-white px-4 py-4"
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

  const addOrderTags = (
    rawValue: string,
    setTags: Dispatch<SetStateAction<string[]>>
  ) => {
    const nextTags = rawValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (nextTags.length === 0) return;
    setTags((prev) => {
      const merged = [...prev];
      nextTags.forEach((tag) => {
        if (!merged.includes(tag)) merged.push(tag);
      });
      return merged;
    });
  };

  const handleOrderInputKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    value: string,
    setValue: Dispatch<SetStateAction<string>>,
    setTags: Dispatch<SetStateAction<string[]>>
  ) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key !== "Enter") return;
    event.preventDefault();
    addOrderTags(value, setTags);
    setValue("");
  };

  const resetForm = () => {
    setForm({ name: "" });
    setOrderTags([]);
    setOrderInput("");
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
    const response = await fetch("/api/saved-bar-orders", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      setListLoading(false);
      toast("저장된 바 순서를 불러오지 못했어요.");
      return;
    }
    const payload = (await response.json()) as { items: SavedBarOrder[] };
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

  const handleOpenEdit = (item: SavedBarOrder) => {
    setEditingId(item.id);
    setForm({ name: item.name });
    setOrderTags(
      item.order_text
        ? item.order_text.split(",").map((s) => s.trim()).filter(Boolean)
        : []
    );
    setOrderInput("");
    setSheetOpen(true);
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!form.name.trim()) {
      toast("이름을 입력해 주세요.");
      return;
    }
    setSaving(true);
    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) {
      setSaving(false);
      return;
    }
    const response = await fetch(
      editingId ? `/api/saved-bar-orders/${editingId}` : "/api/saved-bar-orders",
      {
        method: editingId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          order_text: orderTags.join(", "),
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
    const response = await fetch(`/api/saved-bar-orders/${deleteTarget.id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      toast("삭제에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setDeleteTarget(null);
    await fetchItems();
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
          <h1 className="text-base font-semibold">바 순서 관리</h1>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="text-[#17171c]/70"
            onClick={handleOpenCreate}
            disabled={loading}
            aria-label="바 순서 추가"
          >
            <Plus className="size-5" />
          </Button>
        </header>

        <section className="space-y-3">
          {loading || listLoading ? (
            renderListSkeleton()
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-black/5 bg-white px-4 py-6 text-center">
              <p className="text-sm text-[#17171c]/70">
                저장된 바 순서가 아직 없어요.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-black/5 bg-white px-4 py-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Layers className="h-4 w-4 shrink-0 text-[#17171c]/50" />
                    <span className="truncate text-sm font-medium text-[#17171c]">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-[#17171c]/70"
                      onClick={() => handleOpenEdit(item)}
                      aria-label="바 순서 수정"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-[#17171c]/70"
                      onClick={() => setDeleteTarget(item)}
                      aria-label="바 순서 삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {item.order_text ? (
                  <div className="mt-2 w-full flex flex-wrap items-center gap-2">
                    {item.order_text
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((tag, index, arr) => (
                        <div
                          key={`${item.id}-${tag}-${index}`}
                          className="flex items-center gap-2"
                        >
                          <span className="inline-flex h-7 items-center rounded-full bg-secondary px-2 text-sm">
                            {tag}
                          </span>
                          {index < arr.length - 1 ? (
                            <span className="text-sm text-[#17171c]/40">
                              &gt;
                            </span>
                          ) : null}
                        </div>
                      ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </section>
      </main>

      <Dialog
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="rounded-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{editingId ? "바 순서 수정" : "바 순서 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-[#17171c]/60">이름</Label>
              <Input
                className="h-12 text-base placeholder:text-sm"
                placeholder="예: 기본 순서"
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-3">
              <Label className="text-sm text-[#17171c]/60">바(bar) 순서</Label>
              <div className="space-y-2 rounded-lg border border-black/10 bg-white p-3 min-h-[48px] flex items-center">
                {orderTags.length === 0 ? (
                  <p className="text-sm text-[#17171c]/40">
                    선택된 순서가 여기 표시돼요.
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {orderTags.map((tag, index) => (
                      <div
                        key={`bar-selected-${tag}-${index}`}
                        className="flex items-center gap-2"
                      >
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-9 rounded-full px-3 text-sm"
                          onClick={() =>
                            setOrderTags((prev) =>
                              prev.filter((_, idx) => idx !== index)
                            )
                          }
                        >
                          {tag}
                        </Button>
                        {index < orderTags.length - 1 ? (
                          <span className="text-sm text-[#17171c]/40">
                            &gt;
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {BAR_ORDER_TAGS.map((tag) => {
                  const selected = orderTags.includes(tag);
                  return (
                    <Button
                      key={`bar-tag-${tag}`}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      size="sm"
                      className="h-9 rounded-full px-3 text-sm"
                      onClick={() =>
                        setOrderTags((prev) =>
                          selected
                            ? prev.filter((value) => value !== tag)
                            : [...prev, tag]
                        )
                      }
                    >
                      {tag}
                    </Button>
                  );
                })}
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-[#17171c]/60">직접 입력</Label>
                <Input
                  type="text"
                  className="h-12 text-base placeholder:text-sm"
                  placeholder="직접 입력하고 Enter로 추가해 주세요"
                  value={orderInput}
                  onChange={(event) => setOrderInput(event.target.value)}
                  onKeyDown={(event) =>
                    handleOrderInputKeyDown(
                      event,
                      orderInput,
                      setOrderInput,
                      setOrderTags
                    )
                  }
                />
              </div>
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
                {saving ? <Spinner size="sm" className="text-white" /> : "저장하기"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

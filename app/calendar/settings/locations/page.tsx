"use client";

import { useEffect, useMemo, useState } from "react";
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
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type SavedLocation = {
  id: string;
  name: string;
  address_base: string | null;
  address_detail: string | null;
};

export default function SavedLocationsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [items, setItems] = useState<SavedLocation[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    address_base: "",
    address_detail: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<SavedLocation | null>(null);

  const resetForm = () => {
    setForm({ name: "", address_base: "", address_detail: "" });
    setEditingId(null);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (document.getElementById("kakao-postcode-script")) return;
    const script = document.createElement("script");
    script.id = "kakao-postcode-script";
    script.src =
      "//t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const handleSearchAddress = () => {
    if (typeof window === "undefined") return;
    const kakao = (window as typeof window & { kakao?: any }).kakao;
    if (!kakao?.Postcode) {
      toast("주소 검색을 불러오는 중이에요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    new kakao.Postcode({
      oncomplete: (data: { roadAddress?: string; jibunAddress?: string }) => {
        const address = data.roadAddress || data.jibunAddress || "";
        if (!address) return;
        if (address !== form.address_base) {
          setForm((prev) => ({
            ...prev,
            address_base: address,
            address_detail: "",
          }));
          return;
        }
        setForm((prev) => ({ ...prev, address_base: address }));
      },
    }).open();
  };

  const fetchItems = async () => {
    if (!user) return;
    setListLoading(true);
    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) {
      setListLoading(false);
      return;
    }
    const response = await fetch("/api/saved-locations", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      setListLoading(false);
      toast("저장된 장소를 불러오지 못했어요.");
      return;
    }
    const payload = (await response.json()) as { items: SavedLocation[] };
    setItems(payload.items ?? []);
    setListLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    void fetchItems();
  }, [user?.id]);

  const addressLine = useMemo(() => {
    const base = form.address_base.trim();
    const detail = form.address_detail.trim();
    if (!base && !detail) return "";
    if (!detail) return base;
    return `${base} ${detail}`;
  }, [form.address_base, form.address_detail]);

  const handleOpenCreate = () => {
    resetForm();
    setSheetOpen(true);
  };

  const handleOpenEdit = (item: SavedLocation) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      address_base: item.address_base ?? "",
      address_detail: item.address_detail ?? "",
    });
    setSheetOpen(true);
  };

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
    const response = await fetch(
      editingId ? `/api/saved-locations/${editingId}` : "/api/saved-locations",
      {
        method: editingId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          address_base: form.address_base.trim(),
          address_detail: form.address_detail.trim(),
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
    const response = await fetch(`/api/saved-locations/${deleteTarget.id}`, {
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
          <h1 className="text-base font-semibold">장소 관리</h1>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="text-[#17171c]/70"
            onClick={handleOpenCreate}
            aria-label="장소 추가"
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
                저장된 장소가 아직 없어요.
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
                      <MapPin className="h-4 w-4 text-[#17171c]/50" />
                      {item.name}
                    </div>
                    {item.address_base || item.address_detail ? (
                      <p className="text-xs text-[#17171c]/60">
                        {item.address_base}
                        {item.address_detail
                          ? ` ${item.address_detail}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-[#17171c]/70"
                      onClick={() => handleOpenEdit(item)}
                      aria-label="장소 수정"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-[#17171c]/70"
                      onClick={() => setDeleteTarget(item)}
                      aria-label="장소 삭제"
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
            <Label className="text-xs text-[#17171c]/60">장소 이름</Label>
            <Input
              className="text-sm placeholder:text-xs"
              placeholder="예: 강남 스튜디오"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-[#17171c]/60">주소</Label>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start text-left text-[11px] font-normal"
              onClick={handleSearchAddress}
            >
              {form.address_base.trim() || "주소 검색하기"}
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-[#17171c]/60">상세 주소</Label>
            <Input
              className="text-sm placeholder:text-xs"
              placeholder="상세 주소를 입력해 주세요"
              value={form.address_detail}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  address_detail: event.target.value,
                }))
              }
            />
          </div>
          {addressLine ? (
            <p className="text-xs text-[#17171c]/50">
              입력된 주소: {addressLine}
            </p>
          ) : null}
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
            <AlertDialogTitle>이 장소를 삭제할까요?</AlertDialogTitle>
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

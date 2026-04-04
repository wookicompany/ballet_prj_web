"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";
import { useParams, useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { getAccessToken } from "@/lib/authSession";
import {
  getBarOrdersCache,
  invalidateBarOrdersCache,
} from "@/lib/barOrdersCache";
import { BAR_ORDER_TAGS } from "@/lib/orderTags";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

type SavedBarOrder = {
  id: string;
  name: string;
  order_text: string;
};

type BarOrdersCachePayload = { items: SavedBarOrder[] };

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

function FormSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-12 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-12 w-full" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-16 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function EditBarOrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [name, setName] = useState("");
  const [orderTags, setOrderTags] = useState<string[]>([]);
  const [orderInput, setOrderInput] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    const cached = getBarOrdersCache<BarOrdersCachePayload>();
    const found = cached?.items.find((i) => i.id === id);
    if (found) {
      setName(found.name);
      setOrderTags(
        found.order_text
          ? found.order_text.split(",").map((s) => s.trim()).filter(Boolean)
          : []
      );
      setPageLoading(false);
      return;
    }

    (async () => {
      const accessToken = await getAccessToken(openLoginSheet);
      if (!accessToken) return;
      const res = await fetch(`/api/saved-bar-orders/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        toast("불러오지 못했어요.");
        router.back();
        return;
      }
      const { item } = (await res.json()) as { item: SavedBarOrder };
      setName(item.name);
      setOrderTags(
        item.order_text
          ? item.order_text.split(",").map((s) => s.trim()).filter(Boolean)
          : []
      );
      setPageLoading(false);
    })();
  }, [id, user]);

  const handleSubmit = async () => {
    if (!user) return;
    if (!name.trim()) {
      toast("이름을 입력해 주세요.");
      return;
    }
    setSaving(true);
    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) {
      setSaving(false);
      return;
    }
    const response = await fetch(`/api/saved-bar-orders/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name.trim(),
        order_text: orderTags.join(", "),
      }),
    });
    if (!response.ok) {
      setSaving(false);
      toast("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    invalidateBarOrdersCache();
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
          <h1 className="text-base font-semibold">바 순서 수정</h1>
          <div className="w-10" />
        </header>

        <div className="flex-1">
          {loading || pageLoading ? (
            <FormSkeleton />
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-[#17171c]/60">이름</Label>
                <Input
                  className="h-12 text-base placeholder:text-sm"
                  placeholder="예: 기본 순서"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-3">
                <Label className="text-sm text-[#17171c]/60">바(bar) 순서</Label>
                <div className="space-y-2 rounded-lg border border-[#17171c]/10 bg-white p-3 min-h-[48px] flex items-center">
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
            </div>
          )}
        </div>

        <div className="mt-6">
          <Button
            type="button"
            className="h-12 w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
            onClick={handleSubmit}
            disabled={saving || pageLoading}
          >
            {saving ? <Spinner size="sm" className="text-white" /> : "저장하기"}
          </Button>
        </div>
      </main>
    </MobileContainer>
  );
}

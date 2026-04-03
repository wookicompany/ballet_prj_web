"use client";

import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { getAdminToken } from "@/lib/adminUtils";
import {
  AD_PLACEMENTS,
  AdPlacement,
  isAdPlacement,
  parseKstDateTimeInputToIso,
} from "@/lib/ads";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

const placementOptions: Array<{ value: AdPlacement; label: string }> = [
  { value: "performance_home", label: "공연 홈" },
  { value: "brand_home", label: "브랜드 홈" },
];

function AdminAdNewPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawPlacement = searchParams.get("placement") ?? "";
  const initialPlacement: AdPlacement = isAdPlacement(rawPlacement)
    ? rawPlacement
    : "performance_home";

  const [placement, setPlacement] = useState<AdPlacement>(initialPlacement);
  const [title, setTitle] = useState("");
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [height, setHeight] = useState<50 | 100>(50);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = useMemo(
    () =>
      AD_PLACEMENTS.includes(placement) &&
      title.trim().length > 0 &&
      startAt.length > 0 &&
      endAt.length > 0 &&
      !submitting,
    [placement, title, startAt, endAt, submitting]
  );

  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `ads/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("brands")
      .upload(path, file, { upsert: false });
    if (uploadError) {
      toast("이미지 업로드에 실패했어요.");
      return null;
    }
    const { data } = supabase.storage.from("brands").getPublicUrl(path);
    return data.publicUrl;
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) {
        setError("필수 입력값을 확인해 주세요.");
        return;
      }
      const startAtIso = parseKstDateTimeInputToIso(startAt);
      const endAtIso = parseKstDateTimeInputToIso(endAt);
      if (!startAtIso || !endAtIso) {
        setError("날짜 형식이 올바르지 않아요.");
        return;
      }
      if (startAtIso >= endAtIso) {
        setError("종료일시는 시작일시 이후여야 해요.");
        return;
      }

      const token = await getAdminToken();
      if (!token) {
        setError("로그인이 필요해요.");
        return;
      }

      setSubmitting(true);
      setError(null);

      try {
        let resolvedImageUrl: string | null = null;
        if (imageMode === "upload" && imageFile) {
          resolvedImageUrl = await uploadImage(imageFile);
          if (!resolvedImageUrl) {
            setSubmitting(false);
            return;
          }
        } else if (imageMode === "url" && imageUrlInput.trim()) {
          resolvedImageUrl = imageUrlInput.trim();
        }

        const res = await fetch("/api/admin/ads", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            placement,
            title: title.trim(),
            image_url: resolvedImageUrl,
            link_url: linkUrl.trim() || null,
            height,
            start_at: startAt,
            end_at: endAt,
            is_active: isActive,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.message ?? "광고 등록에 실패했어요.");
          return;
        }
        toast("광고를 등록했어요.");
        if (data.ad?.id) {
          router.replace(`/wookicompany/admin/ads/${data.ad.id}`);
        } else {
          router.replace("/wookicompany/admin/ads");
        }
      } catch {
        toast("광고 등록 중 오류가 발생했어요.");
      } finally {
        setSubmitting(false);
      }
    },
    [
      canSubmit,
      endAt,
      height,
      imageFile,
      imageMode,
      imageUrlInput,
      isActive,
      linkUrl,
      placement,
      router,
      startAt,
      title,
      uploadImage,
    ]
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="새 광고 등록"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/wookicompany/admin/ads">
              <ArrowLeft className="mr-1.5 size-4" />
              목록으로
            </Link>
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-5">
        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* 광고명 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="title">광고명 *</Label>
                <Badge variant="secondary" className="text-xs">필수</Badge>
              </div>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="광고명을 입력해 주세요"
              />
            </div>

            {/* 노출 위치 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>노출 위치 *</Label>
                <Badge variant="secondary" className="text-xs">필수</Badge>
              </div>
              <Select
                value={placement}
                onValueChange={(value) => setPlacement(value as AdPlacement)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="노출 위치를 선택해 주세요" />
                </SelectTrigger>
                <SelectContent>
                  {placementOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 노출 기간 */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="start_at">시작일시 (KST) *</Label>
                  <Badge variant="secondary" className="text-xs">필수</Badge>
                </div>
                <Input
                  id="start_at"
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="end_at">종료일시 (KST) *</Label>
                  <Badge variant="secondary" className="text-xs">필수</Badge>
                </div>
                <Input
                  id="end_at"
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>이미지</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 이미지 입력 방식 */}
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="imageMode"
                  value="upload"
                  checked={imageMode === "upload"}
                  onChange={() => setImageMode("upload")}
                  className="accent-[#FF154A]"
                />
                <span className="text-sm">파일 업로드</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="imageMode"
                  value="url"
                  checked={imageMode === "url"}
                  onChange={() => setImageMode("url")}
                  className="accent-[#FF154A]"
                />
                <span className="text-sm">URL 직접 입력</span>
              </label>
            </div>

            {imageMode === "upload" ? (
              <div className="space-y-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                />
                {imageFile && (
                  <p className="text-xs text-muted-foreground">
                    선택된 파일: {imageFile.name}
                  </p>
                )}
              </div>
            ) : (
              <Input
                type="url"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="https://..."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>링크 및 높이</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* 랜딩 URL */}
            <div className="space-y-2">
              <Label htmlFor="link_url">랜딩 URL</Label>
              <Input
                id="link_url"
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            {/* 높이 */}
            <div className="space-y-2">
              <Label>높이</Label>
              <div className="flex gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="height"
                    value="50"
                    checked={height === 50}
                    onChange={() => setHeight(50)}
                    className="accent-[#FF154A]"
                  />
                  <span className="text-sm">50px</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="height"
                    value="100"
                    checked={height === 100}
                    onChange={() => setHeight(100)}
                    className="accent-[#FF154A]"
                  />
                  <span className="text-sm">100px</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>활성화</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(checked === true)}
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                즉시 활성화
              </Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={!canSubmit}>
            {submitting ? "등록 중…" : "등록"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/wookicompany/admin/ads">취소</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function AdminAdNewPage() {
  return (
    <Suspense>
      <AdminAdNewPageInner />
    </Suspense>
  );
}

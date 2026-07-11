"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { formatAdminDateTime, getAdminToken } from "@/lib/adminUtils";
import {
  AD_PLACEMENTS,
  AdPlacement,
  isAdPlacement,
  parseKstDateTimeInputToIso,
  toKstDateTimeInputValue,
} from "@/lib/ads";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { toast } from "sonner";

type AdDetail = {
  id: string;
  placement: AdPlacement;
  provider: string;
  title: string;
  description: string | null;
  is_active: boolean;
  start_at: string;
  end_at: string;
  image_url: string | null;
  link_url: string | null;
  height: number;
  click_count: number;
  last_clicked_at: string | null;
  impression_count: number;
  created_at: string;
  updated_at: string;
};

const placementOptions: Array<{ value: AdPlacement; label: string }> = [
  { value: "calendar_home", label: "캘린더 팝업" },
  { value: "performance_home", label: "공연 홈" },
  { value: "brand_home", label: "브랜드 홈" },
];

const formatPlacementLabel = (placement: AdPlacement) => {
  if (placement === "calendar_home") return "캘린더 팝업";
  if (placement === "brand_home") return "브랜드 홈";
  return "공연 홈";
};

export default function AdminAdDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [ad, setAd] = useState<AdDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [placement, setPlacement] = useState<AdPlacement>("performance_home");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [height, setHeight] = useState<50 | 100>(50);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [isActive, setIsActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = useMemo(
    () => AD_PLACEMENTS.includes(placement) && title.trim().length > 0 && !submitting,
    [placement, title, submitting]
  );

  const applyAdToForm = useCallback((next: AdDetail) => {
    setPlacement(isAdPlacement(next.placement) ? next.placement : "performance_home");
    setTitle(next.title);
    setDescription(next.description ?? "");
    setImageMode(next.image_url ? "url" : "upload");
    setImageUrlInput(next.image_url ?? "");
    setLinkUrl(next.link_url ?? "");
    setHeight(next.height === 100 ? 100 : 50);
    setStartAt(toKstDateTimeInputValue(next.start_at));
    setEndAt(toKstDateTimeInputValue(next.end_at));
    setIsActive(next.is_active);
  }, []);

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

  const fetchDetail = useCallback(async () => {
    const token = await getAdminToken();
    if (!token) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/admin/ads/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError("광고 상세 정보를 불러오지 못했습니다.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      const next = data.ad as AdDetail | undefined;
      if (next) {
        setAd(next);
        applyAdToForm(next);
      }
    } catch {
      setError("광고 상세 정보를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [id, applyAdToForm]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const handleSave = useCallback(async () => {
    if (!ad || !canSubmit) {
      setError("필수 입력값을 확인해 주세요.");
      return;
    }
    const token = await getAdminToken();
    if (!token) {
      setError("로그인이 필요해요.");
      return;
    }

    if (startAt && endAt) {
      const startIso = parseKstDateTimeInputToIso(startAt);
      const endIso = parseKstDateTimeInputToIso(endAt);
      if (!startIso || !endIso) {
        setError("날짜 형식이 올바르지 않아요.");
        return;
      }
      if (startIso >= endIso) {
        setError("종료일시는 시작일시 이후여야 해요.");
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      let resolvedImageUrl: string | null | undefined = undefined;
      if (imageMode === "upload" && imageFile) {
        resolvedImageUrl = await uploadImage(imageFile);
        if (!resolvedImageUrl) {
          setSubmitting(false);
          return;
        }
      } else if (imageMode === "url") {
        resolvedImageUrl = imageUrlInput.trim() || null;
      }

      const body: Record<string, unknown> = {
        placement,
        title: title.trim(),
        description: description.trim() || null,
        link_url: linkUrl.trim() || null,
        height,
        is_active: isActive,
      };
      if (resolvedImageUrl !== undefined) {
        body.image_url = resolvedImageUrl;
      }
      if (startAt) body.start_at = startAt;
      if (endAt) body.end_at = endAt;

      const res = await fetch(`/api/admin/ads/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "저장에 실패했어요.");
        return;
      }
      if (data.ad) {
        setAd(data.ad);
        applyAdToForm(data.ad);
      }
      setEditing(false);
      setImageFile(null);
      toast("광고를 저장했어요.");
    } catch {
      setError("광고 저장 중 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  }, [
    ad,
    applyAdToForm,
    canSubmit,
    description,
    endAt,
    height,
    id,
    imageFile,
    imageMode,
    imageUrlInput,
    isActive,
    linkUrl,
    placement,
    startAt,
    title,
    uploadImage,
  ]);

  const handleDelete = useCallback(async () => {
    const token = await getAdminToken();
    if (!token) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/ads/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast("광고를 삭제했어요.");
        router.replace("/wookicompany/admin/ads");
      } else {
        toast("광고 삭제에 실패했어요.");
      }
    } finally {
      setDeleting(false);
    }
  }, [id, router]);

  if (loading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="광고 상세" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (error && !ad) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="광고 상세" />
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchDetail}>
              다시 시도
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/wookicompany/admin/ads">목록으로</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!ad) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="광고 상세" />
        <div className="rounded-md border border-border p-4">
          <p className="text-sm text-muted-foreground">광고를 찾을 수 없습니다.</p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link href="/wookicompany/admin/ads">목록으로</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="광고 상세"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/wookicompany/admin/ads">
              <ArrowLeft className="mr-1.5 size-4" />
              목록으로
            </Link>
          </Button>
        }
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>광고 정보</CardTitle>
          <div className="flex items-center gap-2">
            {!editing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="mr-1 size-4" />
                  수정
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={deleting}>
                      <Trash2 className="mr-1 size-4" />
                      삭제
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>광고 삭제</AlertDialogTitle>
                      <AlertDialogDescription>
                        이 광고를 삭제합니다. 복구할 수 없습니다. 계속할까요?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground"
                      >
                        삭제
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <>
                <Button size="sm" onClick={handleSave} disabled={submitting || !canSubmit}>
                  {submitting ? "저장 중…" : "저장"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={submitting}
                  onClick={() => {
                    setEditing(false);
                    applyAdToForm(ad);
                    setImageFile(null);
                    setError(null);
                  }}
                >
                  취소
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 요약 카드 */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border p-3 lg:col-span-2">
              <p className="text-xs text-muted-foreground">광고명</p>
              <p className="mt-1 font-medium">{ad.title || "미입력"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">노출 위치</p>
              <p className="mt-1 font-medium">{formatPlacementLabel(ad.placement)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">상태</p>
              <p className="mt-1">
                <Badge variant={ad.is_active ? "default" : "secondary"}>
                  {ad.is_active ? "활성" : "비활성"}
                </Badge>
              </p>
            </div>
            {ad.placement !== "calendar_home" && (
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">높이</p>
                <p className="mt-1 font-medium">{ad.height}px</p>
              </div>
            )}
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">노출수</p>
              <p className="mt-1 font-medium tabular-nums">{ad.impression_count}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">클릭수</p>
              <p className="mt-1 font-medium tabular-nums">{ad.click_count}</p>
            </div>
            <div className="rounded-md border p-3 lg:col-span-2">
              <p className="text-xs text-muted-foreground">노출 기간 (KST)</p>
              <p className="mt-1 font-medium">
                {formatAdminDateTime(ad.start_at)} ~ {formatAdminDateTime(ad.end_at)}
              </p>
            </div>
            {ad.link_url && (
              <div className="rounded-md border p-3 lg:col-span-2">
                <p className="text-xs text-muted-foreground">랜딩 URL</p>
                <p className="mt-1 truncate font-medium text-sm">{ad.link_url}</p>
              </div>
            )}
            {ad.description && (
              <div className="rounded-md border p-3 lg:col-span-4">
                <p className="text-xs text-muted-foreground">내용</p>
                <p className="mt-1 whitespace-pre-wrap font-medium text-sm">{ad.description}</p>
              </div>
            )}
          </div>

          {/* 이미지 미리보기 */}
          {ad.image_url && (
            <div className="space-y-2">
              <p className="text-sm font-medium">이미지 미리보기</p>
              {ad.placement === "calendar_home" ? (
                <div
                  className="relative overflow-hidden rounded-lg border"
                  style={{ maxWidth: 430 }}
                >
                  <Image
                    src={ad.image_url}
                    alt="광고 이미지"
                    width={430}
                    height={430}
                    className="h-auto max-h-[400px] w-full object-contain"
                    unoptimized
                  />
                </div>
              ) : (
                <div
                  className="relative overflow-hidden rounded-lg border"
                  style={{ height: ad.height, maxWidth: 430 }}
                >
                  <Image
                    src={ad.image_url}
                    alt="광고 이미지"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}
            </div>
          )}

          {/* 수정 폼 */}
          {editing && (
            <div className="max-w-3xl space-y-5 rounded-md border p-4">
              {/* 광고명 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit_title">광고명 *</Label>
                  <Badge variant="secondary" className="text-xs">필수</Badge>
                </div>
                <Input
                  id="edit_title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="광고명을 입력해 주세요"
                />
              </div>

              {/* 내용 */}
              <div className="space-y-2">
                <Label htmlFor="edit_description">내용</Label>
                <Textarea
                  id="edit_description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="팝업 본문에 노출할 내용을 입력해 주세요"
                  rows={4}
                />
              </div>

              {/* 노출 위치 */}
              <div className="space-y-2">
                <Label>노출 위치 *</Label>
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
                  <Label htmlFor="edit_start_at">시작일시 (KST)</Label>
                  <Input
                    id="edit_start_at"
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_end_at">종료일시 (KST)</Label>
                  <Input
                    id="edit_end_at"
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                  />
                </div>
              </div>

              {/* 이미지 입력 방식 */}
              <div className="space-y-3">
                <Label>이미지</Label>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="edit_imageMode"
                      value="upload"
                      checked={imageMode === "upload"}
                      onChange={() => setImageMode("upload")}
                      className="accent-brand"
                    />
                    <span className="text-sm">파일 업로드</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="edit_imageMode"
                      value="url"
                      checked={imageMode === "url"}
                      onChange={() => setImageMode("url")}
                      className="accent-brand"
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
              </div>

              {/* 랜딩 URL */}
              <div className="space-y-2">
                <Label htmlFor="edit_link_url">랜딩 URL</Label>
                <Input
                  id="edit_link_url"
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              {/* 높이 (배너 형태로 노출되는 위치에서만 사용) */}
              {placement !== "calendar_home" && (
              <div className="space-y-2">
                <Label>높이</Label>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="edit_height"
                      value="50"
                      checked={height === 50}
                      onChange={() => setHeight(50)}
                      className="accent-brand"
                    />
                    <span className="text-sm">50px</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="edit_height"
                      value="100"
                      checked={height === 100}
                      onChange={() => setHeight(100)}
                      className="accent-brand"
                    />
                    <span className="text-sm">100px</span>
                  </label>
                </div>
              </div>
              )}

              {/* 활성화 */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit_is_active"
                  checked={isActive}
                  onCheckedChange={(checked) => setIsActive(checked === true)}
                />
                <Label htmlFor="edit_is_active" className="cursor-pointer">
                  활성화
                </Label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

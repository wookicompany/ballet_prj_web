"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import { supabase } from "@/lib/supabaseClient";
import { AD_PLACEMENTS, AdPlacement } from "@/lib/ads";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatIsoToSeoulDate } from "@/lib/kstDateTime";
import { toast } from "sonner";

const BUCKET = "record-media";
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

type AdDetail = {
  id: string;
  placement: AdPlacement;
  provider: string;
  title: string;
  description: string | null;
  image_url: string;
  target_url: string;
  is_active: boolean;
  start_at: string;
  end_at: string;
  click_count: number;
  last_clicked_at: string | null;
  created_at: string;
  updated_at: string;
};

const placementOptions: Array<{ value: AdPlacement; label: string }> = [
  { value: "calendar_home", label: "캘린더 홈" },
  { value: "performance_home", label: "공연 홈" },
];

const toKstDateInputValue = (value: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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

  const [placement, setPlacement] = useState<AdPlacement>("calendar_home");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(false);

  const canSubmit = useMemo(
    () =>
      title.trim() &&
      startDate &&
      endDate &&
      targetUrl.trim() &&
      imageUrl.trim() &&
      AD_PLACEMENTS.includes(placement),
    [title, startDate, endDate, targetUrl, imageUrl, placement]
  );

  const applyAdToForm = useCallback((next: AdDetail) => {
    setPlacement(next.placement);
    setTitle(next.title);
    setDescription(next.description ?? "");
    setStartDate(toKstDateInputValue(next.start_at));
    setEndDate(toKstDateInputValue(next.end_at));
    setTargetUrl(next.target_url);
    setImageUrl(next.image_url);
    setIsActive(next.is_active);
  }, []);

  const fetchDetail = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/admin/ads/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      const next = data.ad as AdDetail | undefined;
      if (next) {
        setAd(next);
        applyAdToForm(next);
      }
    } finally {
      setLoading(false);
    }
  }, [id, applyAdToForm]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const handleUploadImage = async (file: File) => {
    if (file.size > MAX_IMAGE_SIZE) {
      toast("이미지 용량은 20MB 이하여야 해요.");
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) {
      toast("로그인이 필요해요.");
      return;
    }
    const path = `${userId}/admin-ads/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file);
    if (uploadError) {
      toast("이미지 업로드에 실패했어요.");
      return;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    setImageUrl(data.publicUrl);
    toast("이미지 업로드가 완료됐어요.");
  };

  const handleSave = useCallback(async () => {
    if (!ad || !canSubmit) {
      toast("필수 입력값을 확인해 주세요.");
      return;
    }
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      toast("로그인이 필요해요.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/ads/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          placement,
          title: title.trim(),
          description: description.trim() || null,
          start_at: `${startDate}T00:00`,
          end_at: `${endDate}T23:59`,
          target_url: targetUrl.trim(),
          image_url: imageUrl.trim(),
          is_active: isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.message ?? "저장에 실패했어요.");
        return;
      }
      if (data.ad) {
        setAd(data.ad);
        applyAdToForm(data.ad);
      }
      setEditing(false);
      toast("광고를 저장했어요.");
    } finally {
      setSubmitting(false);
    }
  }, [
    ad,
    applyAdToForm,
    canSubmit,
    description,
    endDate,
    id,
    imageUrl,
    isActive,
    placement,
    startDate,
    targetUrl,
    title,
  ]);

  const handleDelete = useCallback(async () => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
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
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (!ad) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">광고를 찾을 수 없습니다.</p>
        <Button variant="outline" asChild>
          <Link href="/wookicompany/admin/ads">목록으로</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/wookicompany/admin/ads">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">광고 상세</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>기본 정보</CardTitle>
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
                  }}
                >
                  취소
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editing ? (
            <div className="max-w-3xl space-y-5">
              <div className="space-y-2">
                <Label htmlFor="placement">노출 위치</Label>
                <select
                  id="placement"
                  value={placement}
                  onChange={(e) => setPlacement(e.target.value as AdPlacement)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {placementOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">광고명</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">설명/메모 (선택)</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start_date">시작 날짜 (KST)</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">종료 날짜 (KST)</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="target_url">URL Link</Label>
                <Input
                  id="target_url"
                  type="url"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image_upload">이미지 업로드</Label>
                <Input
                  id="image_upload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void handleUploadImage(file);
                  }}
                />
                <Label htmlFor="image_url">이미지 URL</Label>
                <Input
                  id="image_url"
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_active"
                  checked={isActive}
                  onCheckedChange={(checked) => setIsActive(checked === true)}
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  활성화
                </Label>
              </div>
            </div>
          ) : (
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">노출 위치</dt>
                <dd className="font-medium">
                  {ad.placement === "calendar_home" ? "캘린더 홈" : "공연 홈"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">공급자</dt>
                <dd>{ad.provider.toUpperCase()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">광고명</dt>
                <dd className="font-medium">{ad.title}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">상태</dt>
                <dd>
                  <Badge variant={ad.is_active ? "default" : "secondary"}>
                    {ad.is_active ? "활성" : "비활성"}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">노출 시작/종료 (KST)</dt>
                <dd>
                  {formatIsoToSeoulDate(ad.start_at)} ~ {formatIsoToSeoulDate(ad.end_at)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">URL Link</dt>
                <dd className="break-all">{ad.target_url}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">이미지 URL</dt>
                <dd className="break-all">{ad.image_url}</dd>
              </div>
              {ad.description ? (
                <div>
                  <dt className="text-muted-foreground">설명/메모</dt>
                  <dd>{ad.description}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground">클릭수</dt>
                <dd>{ad.click_count}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">생성일</dt>
                <dd>{formatIsoToSeoulDate(ad.created_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">수정일</dt>
                <dd>{formatIsoToSeoulDate(ad.updated_at)}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

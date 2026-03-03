"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import { AD_PLACEMENTS, AdPlacement } from "@/lib/ads";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

const BUCKET = "record-media";
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 200;

const placementOptions: Array<{ value: AdPlacement; label: string }> = [
  { value: "calendar_home", label: "캘린더 홈" },
  { value: "performance_home", label: "공연 홈" },
];

export default function AdminAdNewPage() {
  const router = useRouter();
  const [placement, setPlacement] = useState<AdPlacement>("calendar_home");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedTitle = title.trim();
  const trimmedTargetUrl = targetUrl.trim();
  const trimmedImageUrl = imageUrl.trim();
  const hasInvalidPeriod = !!startDate && !!endDate && startDate > endDate;

  const canSubmit = useMemo(
    () =>
      trimmedTitle &&
      startDate &&
      endDate &&
      !hasInvalidPeriod &&
      trimmedTargetUrl &&
      trimmedImageUrl &&
      AD_PLACEMENTS.includes(placement) &&
      !submitting,
    [
      trimmedTitle,
      startDate,
      endDate,
      hasInvalidPeriod,
      trimmedTargetUrl,
      trimmedImageUrl,
      placement,
      submitting,
    ]
  );

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasInvalidPeriod) {
      setError("종료 날짜는 시작 날짜보다 같거나 늦어야 합니다.");
      return;
    }
    if (!canSubmit) {
      setError("필수 입력값을 확인해 주세요.");
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("로그인이 필요해요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          placement,
          title: trimmedTitle,
          description: description.trim() || null,
          start_at: `${startDate}T00:00`,
          end_at: `${endDate}T23:59`,
          target_url: trimmedTargetUrl,
          image_url: trimmedImageUrl,
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
  };

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
            <div className="space-y-2">
              <Label htmlFor="placement">노출 위치 *</Label>
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
              <p className="text-xs text-muted-foreground">
                {placement === "calendar_home"
                  ? "캘린더 홈 슬롯 권장 사이즈: 320x50"
                  : "공연 홈 슬롯 권장 사이즈: 320x100"}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="title">광고명 *</Label>
                <span className="text-xs text-muted-foreground">
                  {title.length.toLocaleString("ko-KR")} / {TITLE_MAX_LENGTH.toLocaleString("ko-KR")}
                </span>
              </div>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="광고명을 입력해 주세요"
                maxLength={TITLE_MAX_LENGTH}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">설명/메모 (선택)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="내부 관리용 메모"
                maxLength={DESCRIPTION_MAX_LENGTH}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>노출 기간</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start_date">시작 날짜 (KST) *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">종료 날짜 (KST) *</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              선택한 기간 동안 노출되며, 시작일 00:00 ~ 종료일 23:59(KST)로 저장됩니다.
            </p>
            {hasInvalidPeriod ? (
              <p className="text-xs text-destructive">
                종료 날짜는 시작 날짜보다 같거나 늦어야 합니다.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>랜딩 및 이미지</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="target_url">URL Link *</Label>
              <Input
                id="target_url"
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://example.com"
                required
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
              <p className="text-xs text-muted-foreground">
                업로드 시 이미지 URL에 자동 반영됩니다.
              </p>
              <Label htmlFor="image_url">이미지 URL</Label>
              <Input
                id="image_url"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                required
              />
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

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

const BUCKET = "record-media";
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

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
    if (!canSubmit) {
      toast("필수 입력값을 확인해 주세요.");
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      toast("로그인이 필요해요.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/ads", {
        method: "POST",
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
        toast(data.message ?? "광고 등록에 실패했어요.");
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/wookicompany/admin/ads">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">새 광고 등록</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>광고 작성</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="max-w-3xl space-y-5">
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
                placeholder="광고명을 입력해 주세요"
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
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">종료 날짜 (KST)</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
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

            <div className="flex gap-2">
              <Button type="submit" disabled={submitting || !canSubmit}>
                {submitting ? "등록 중…" : "등록"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/wookicompany/admin/ads">취소</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

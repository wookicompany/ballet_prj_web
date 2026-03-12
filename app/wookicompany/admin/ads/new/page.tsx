"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import { AD_PLACEMENTS, AdPlacement } from "@/lib/ads";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  { value: "calendar_home", label: "캘린더 홈" },
  { value: "profile_home", label: "프로필 홈" },
  { value: "performance_home", label: "공연 홈" },
];

export default function AdminAdNewPage() {
  const router = useRouter();
  const [placement, setPlacement] = useState<AdPlacement>("performance_home");
  const [isActive, setIsActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () =>
      AD_PLACEMENTS.includes(placement) && !submitting,
    [placement, submitting]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
              <div className="flex items-center justify-between">
                <Label>노출 위치 *</Label>
                <Badge variant="secondary" className="text-xs">
                  필수
                </Badge>
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
              <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  탭 홈 AdSense 슬롯 권장 사이즈: 100x50
                </p>
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

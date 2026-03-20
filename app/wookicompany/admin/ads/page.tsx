"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { getAdminToken } from "@/lib/adminUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { Plus, RefreshCw } from "lucide-react";
import { AD_PLACEMENTS } from "@/lib/ads";

type AdRow = {
  id: string;
  placement: "calendar_home" | "performance_home" | "profile_home";
  provider: "adsense";
  is_active: boolean;
};

export default function AdminAdsPage() {
  const [ads, setAds] = useState<AdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingPlacement, setUpdatingPlacement] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getPlacementLabel = useCallback((placement: AdRow["placement"]) => {
    if (placement === "calendar_home") return "캘린더 홈";
    if (placement === "profile_home") return "프로필 홈";
    return "공연 홈";
  }, []);

  const fetchAds = useCallback(async () => {
    const token = await getAdminToken();
    if (!token) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ads?limit=100&offset=0", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError("광고 목록을 불러오지 못했습니다.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      const rows = (data.ads ?? []) as AdRow[];
      const latestByPlacement = new Map<AdRow["placement"], AdRow>();
      for (const row of rows) {
        if (!latestByPlacement.has(row.placement)) {
          latestByPlacement.set(row.placement, row);
        }
      }
      const orderedRows = AD_PLACEMENTS.map((placement) =>
        latestByPlacement.get(placement)
      ).filter((row): row is AdRow => Boolean(row));
      setAds(orderedRows);
    } catch {
      setError("광고 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAds();
  }, [fetchAds]);

  const handleToggle = useCallback(
    async (ad: AdRow, nextActive: boolean) => {
      const token = await getAdminToken();
      if (!token) {
        setError("로그인이 필요합니다.");
        return;
      }

      setUpdatingPlacement(ad.placement);
      setError(null);
      try {
        const res = await fetch(`/api/admin/ads/${ad.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ is_active: nextActive }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          setError(payload.message ?? "상태 변경에 실패했습니다.");
          return;
        }
        setAds((prev) =>
          prev.map((a) => (a.id === ad.id ? { ...a, is_active: nextActive } : a))
        );
      } catch {
        setError("상태 변경 중 오류가 발생했습니다.");
      } finally {
        setUpdatingPlacement(null);
      }
    },
    []
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="광고 관리"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAds()}
              disabled={loading || !!updatingPlacement}
            >
              <RefreshCw className="mr-1.5 size-4" />
              새로고침
            </Button>
            <Button size="sm" asChild>
              <Link href="/wookicompany/admin/ads/new">
                <Plus className="mr-1.5 size-4" />
                새 광고
              </Link>
            </Button>
          </div>
        }
      />
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>탭 홈 광고 슬롯</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => fetchAds()}
              >
                다시 시도
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>위치</TableHead>
                    <TableHead>공급자</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="w-[180px]">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        등록된 광고가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    ads.map((ad) => (
                      <TableRow key={ad.id} className="hover:bg-muted/40">
                        <TableCell>{getPlacementLabel(ad.placement)}</TableCell>
                        <TableCell className="uppercase text-muted-foreground">
                          {ad.provider}
                        </TableCell>
                        <TableCell>
                          <Badge variant={ad.is_active ? "default" : "secondary"}>
                            {ad.is_active ? "활성" : "비활성"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={ad.is_active}
                            disabled={updatingPlacement === ad.placement}
                            onCheckedChange={(checked) => {
                              void handleToggle(ad, checked);
                            }}
                            aria-label={`${getPlacementLabel(ad.placement)} 광고 노출 토글`}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

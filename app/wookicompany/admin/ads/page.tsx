"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import { formatAdminDateTime, getAdminToken } from "@/lib/adminUtils";
import { AdPlacement } from "@/lib/ads";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { ChevronRight, Plus, RefreshCw } from "lucide-react";

type AdRow = {
  id: string;
  placement: AdPlacement;
  title: string;
  is_active: boolean;
  start_at: string;
  end_at: string;
  image_url: string | null;
  height: number;
  impression_count: number;
  click_count: number;
};

type TabPlacement = "performance_home" | "brand_home";

const TAB_OPTIONS: Array<{ value: TabPlacement; label: string }> = [
  { value: "performance_home", label: "공연 홈" },
  { value: "brand_home", label: "브랜드 홈" },
];

export default function AdminAdsPage() {
  const [allAds, setAllAds] = useState<AdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabPlacement>("performance_home");

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
      setAllAds((data.ads ?? []) as AdRow[]);
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

      setUpdatingId(ad.id);
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
        setAllAds((prev) =>
          prev.map((a) => (a.id === ad.id ? { ...a, is_active: nextActive } : a))
        );
      } catch {
        setError("상태 변경 중 오류가 발생했습니다.");
      } finally {
        setUpdatingId(null);
      }
    },
    []
  );

  const filteredAds = allAds.filter((ad) => ad.placement === activeTab);

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
              disabled={loading || !!updatingId}
            >
              <RefreshCw className="mr-1.5 size-4" />
              새로고침
            </Button>
            <Button size="sm" asChild>
              <Link href={`/wookicompany/admin/ads/new?placement=${activeTab}`}>
                <Plus className="mr-1.5 size-4" />
                새 광고 등록
              </Link>
            </Button>
          </div>
        }
      />
      <Card>
        <CardHeader className="space-y-4">
          <CardTitle>광고 목록</CardTitle>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabPlacement)}
          >
            <TabsList>
              {TAB_OPTIONS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
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
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[20%]">썸네일</TableHead>
                  <TableHead className="w-[22%]">광고명</TableHead>
                  <TableHead className="w-[10%]">노출수</TableHead>
                  <TableHead className="w-[10%]">클릭수</TableHead>
                  <TableHead className="w-[10%]">상태</TableHead>
                  <TableHead className="w-[23%]">노출 기간</TableHead>
                  <TableHead className="w-[5%]" />
                  <TableHead className="w-[5%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAds.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      등록된 광고가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAds.map((ad) => (
                    <TableRow key={ad.id} className="hover:bg-muted/40">
                      <TableCell>
                        {ad.image_url ? (
                          <div className="relative h-10 w-40 overflow-hidden rounded">
                            <Image
                              src={ad.image_url}
                              alt={ad.title}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="flex h-10 w-40 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                            없음
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{ad.title}</TableCell>
                      <TableCell className="tabular-nums">{ad.impression_count}</TableCell>
                      <TableCell className="tabular-nums">{ad.click_count}</TableCell>
                      <TableCell>
                        <Badge variant={ad.is_active ? "default" : "secondary"}>
                          {ad.is_active ? "활성" : "비활성"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatAdminDateTime(ad.start_at)}
                        <br />~ {formatAdminDateTime(ad.end_at)}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={ad.is_active}
                          disabled={updatingId === ad.id}
                          onCheckedChange={(checked) => {
                            void handleToggle(ad, checked);
                          }}
                          aria-label={`${ad.title} 광고 노출 토글`}
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/wookicompany/admin/ads/${ad.id}`}>
                            <ChevronRight className="size-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

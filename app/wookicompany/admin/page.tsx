"use client";

import { useCallback, useEffect, useState } from "react";
import { getAdminToken } from "@/lib/adminUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { RefreshCw } from "lucide-react";

type Stats = {
  total_users: number;
  total_records: number;
  calendar_users: number;
  total_reviews: number;
  total_comments: number;
  performance_users: number;
  total_brand_likes: number;
  brand_users: number;
};

const CALENDAR_ITEMS = [
  { key: "calendar_users" as const, label: "캘린더 사용자 수" },
  { key: "total_records" as const, label: "캘린더 기록 등록 건 수" },
];
const PERFORMANCE_ITEMS = [
  { key: "performance_users" as const, label: "공연 사용자 수" },
  { key: "total_reviews" as const, label: "공연 리뷰 등록 건 수" },
  { key: "total_comments" as const, label: "공연 댓글 등록 건 수" },
];
const BRAND_ITEMS = [
  { key: "brand_users" as const, label: "브랜드 사용자 수" },
  { key: "total_brand_likes" as const, label: "브랜드 찜 건 수" },
];

function StatCard({
  label,
  value,
  "aria-label": ariaLabel,
}: {
  label: string;
  value: number;
  "aria-label"?: string;
}) {
  return (
    <Card
      className="flex min-h-[110px] w-full min-w-0 flex-col justify-between overflow-visible transition-colors hover:bg-muted/50"
      aria-label={ariaLabel ?? `${label}: ${value.toLocaleString()}`}
    >
      <CardHeader className="shrink-0 pb-1 pt-3">
        <CardTitle className="text-sm font-medium leading-snug text-muted-foreground break-words">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="shrink-0 pb-3 pt-0">
        <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
          {value.toLocaleString("ko-KR")}
        </p>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    const token = await getAdminToken();
    if (!token) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError("통계를 불러올 수 없습니다.");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as Stats;
      setStats(data);
    } catch {
      setError("통계를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="대시보드" />
        <div className="space-y-8">
          {/* 사용자 스켈레톤 */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-14" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="min-h-[110px] w-full rounded-lg" />
            </div>
          </div>
          {/* 캘린더 스켈레톤 */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-14" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="min-h-[110px] w-full rounded-lg" />
              <Skeleton className="min-h-[110px] w-full rounded-lg" />
            </div>
          </div>
          {/* 공연 스켈레톤 */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-14" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="min-h-[110px] w-full rounded-lg" />
              <Skeleton className="min-h-[110px] w-full rounded-lg" />
              <Skeleton className="min-h-[110px] w-full rounded-lg" />
            </div>
          </div>
          {/* 브랜드 스켈레톤 */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-14" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="min-h-[110px] w-full rounded-lg" />
              <Skeleton className="min-h-[110px] w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-4">
        <AdminPageHeader
          title="대시보드"
        />
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive">
          <p className="text-sm font-medium">{error ?? "데이터가 없습니다."}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 border-destructive/50 text-destructive hover:bg-destructive/10"
            onClick={() => {
              setLoading(true);
              fetchStats();
            }}
          >
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="대시보드"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              fetchStats();
            }}
            aria-label="통계 새로고침"
          >
            <RefreshCw className="size-4 mr-1.5" />
            새로고침
          </Button>
        }
      />

      <div className="space-y-8" role="region" aria-label="대시보드 지표">
        {/* 사용자 */}
        <section className="space-y-3" aria-labelledby="section-users">
          <h2 id="section-users" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            사용자
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="min-w-0">
              <StatCard label="총 가입자 수" value={stats.total_users} />
            </div>
          </div>
        </section>

        {/* 캘린더 */}
        <section className="space-y-3" aria-labelledby="section-calendar">
          <h2 id="section-calendar" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            캘린더
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CALENDAR_ITEMS.map((item) => (
              <div key={item.key} className="min-w-0">
                <StatCard label={item.label} value={stats[item.key]} />
              </div>
            ))}
          </div>
        </section>

        {/* 공연 */}
        <section className="space-y-3" aria-labelledby="section-performance">
          <h2 id="section-performance" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            공연
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PERFORMANCE_ITEMS.map((item) => (
              <div key={item.key} className="min-w-0">
                <StatCard label={item.label} value={stats[item.key]} />
              </div>
            ))}
          </div>
        </section>

        {/* 브랜드 */}
        <section className="space-y-3" aria-labelledby="section-brand">
          <h2 id="section-brand" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            브랜드
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BRAND_ITEMS.map((item) => (
              <div key={item.key} className="min-w-0">
                <StatCard label={item.label} value={stats[item.key]} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

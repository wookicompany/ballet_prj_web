"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
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
};

const TOTAL_USERS = { key: "total_users" as const, label: "총 가입자 수" };
const CALENDAR_ITEMS = [
  { key: "calendar_users" as const, label: "캘린더 사용자 수" },
  { key: "total_records" as const, label: "캘린더 기록 등록 건 수" },
];
const PERFORMANCE_ITEMS = [
  { key: "performance_users" as const, label: "공연 사용자 수" },
  { key: "total_reviews" as const, label: "공연 리뷰 등록 건 수" },
  { key: "total_comments" as const, label: "공연 댓글 등록 건 수" },
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
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
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
        <AdminPageHeader
          title="대시보드"
        />
        <div className="space-y-8">
          <div className="space-y-3">
            <Skeleton className="h-5 w-16" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Skeleton className="min-h-[110px] w-full rounded-lg" />
            </div>
          </div>
          <div className="space-y-3">
            <Skeleton className="h-5 w-16" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="min-h-[110px] w-full rounded-lg" />
              <Skeleton className="min-h-[110px] w-full rounded-lg" />
            </div>
          </div>
          <div className="space-y-3">
            <Skeleton className="h-5 w-16" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="min-h-[110px] w-full rounded-lg" />
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
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
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

      {/* 1행 사용자 | 2행 캘린더 | 3행 공연, 카드 동일 크기(3열 그리드) */}
      <div className="space-y-8" role="region" aria-label="대시보드 지표">
        {/* 1행: 사용자 — 3열 그리드로 카드 크기 통일 */}
        <section className="space-y-3" aria-labelledby="section-users">
          <h2 id="section-users" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            사용자
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="min-w-0">
              <StatCard
                label={TOTAL_USERS.label}
                value={stats[TOTAL_USERS.key]}
                aria-label={`${TOTAL_USERS.label}: ${stats[TOTAL_USERS.key].toLocaleString("ko-KR")}명`}
              />
            </div>
          </div>
        </section>

        {/* 2행: 캘린더 */}
        <section className="space-y-3" aria-labelledby="section-calendar">
          <h2 id="section-calendar" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            캘린더
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="min-w-0">
              <StatCard label={CALENDAR_ITEMS[0].label} value={stats[CALENDAR_ITEMS[0].key]} />
            </div>
            <div className="min-w-0">
              <StatCard label={CALENDAR_ITEMS[1].label} value={stats[CALENDAR_ITEMS[1].key]} />
            </div>
          </div>
        </section>

        {/* 3행: 공연 */}
        <section className="space-y-3" aria-labelledby="section-performance">
          <h2 id="section-performance" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            공연
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="min-w-0">
              <StatCard label={PERFORMANCE_ITEMS[0].label} value={stats[PERFORMANCE_ITEMS[0].key]} />
            </div>
            <div className="min-w-0">
              <StatCard label={PERFORMANCE_ITEMS[1].label} value={stats[PERFORMANCE_ITEMS[1].key]} />
            </div>
            <div className="min-w-0">
              <StatCard label={PERFORMANCE_ITEMS[2].label} value={stats[PERFORMANCE_ITEMS[2].key]} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

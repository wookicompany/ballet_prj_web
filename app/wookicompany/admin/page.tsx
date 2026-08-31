"use client";

import { useCallback, useEffect, useState } from "react";
import { getAdminToken } from "@/lib/adminUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import CalendarTrendChart from "@/components/admin/CalendarTrendChart";
import SignupTrendChart from "@/components/admin/SignupTrendChart";
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

function SectionCard({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: number }[];
}) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-sm font-semibold text-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4 pt-0">
        <div className="divide-y">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <span className="text-xl font-bold tabular-nums tracking-tight text-foreground">
                {item.value.toLocaleString("ko-KR")}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SectionCardSkeleton({ rows }: { rows: number }) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-2 pt-4">
        <Skeleton className="h-3 w-16" />
      </CardHeader>
      <CardContent className="pb-4 pt-0">
        <div className="divide-y">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SectionCardSkeleton rows={1} />
          <SectionCardSkeleton rows={2} />
          <SectionCardSkeleton rows={3} />
          <SectionCardSkeleton rows={2} />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-4">
        <AdminPageHeader title="대시보드" />
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2" role="region" aria-label="대시보드 지표">
        <SectionCard
          title="사용자"
          items={[
            { label: "총 가입자 수", value: stats.total_users },
          ]}
        />
        <SectionCard
          title="캘린더"
          items={[
            { label: "캘린더 사용자 수", value: stats.calendar_users },
            { label: "기록 등록 건 수(완료)", value: stats.total_records },
          ]}
        />
        <SectionCard
          title="공연"
          items={[
            { label: "공연 사용자 수", value: stats.performance_users },
            { label: "리뷰 등록 건 수", value: stats.total_reviews },
            { label: "댓글 등록 건 수", value: stats.total_comments },
          ]}
        />
        <SectionCard
          title="브랜드"
          items={[
            { label: "브랜드 사용자 수", value: stats.brand_users },
            { label: "찜 건 수", value: stats.total_brand_likes },
          ]}
        />
        <div className="md:col-span-2">
          <SignupTrendChart />
        </div>
        <div className="md:col-span-2">
          <CalendarTrendChart />
        </div>
      </div>
    </div>
  );
}

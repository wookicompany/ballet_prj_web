"use client";

import { useCallback, useEffect, useState } from "react";
import { getAdminToken } from "@/lib/adminUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import BrandTrendChart from "@/components/admin/BrandTrendChart";
import CalendarTrendChart from "@/components/admin/CalendarTrendChart";
import PerformanceTrendChart from "@/components/admin/PerformanceTrendChart";
import SignupTrendChart from "@/components/admin/SignupTrendChart";
import { RefreshCw } from "lucide-react";

type Stats = {
  total_users: number;
  total_records: number;
  calendar_users: number;
  total_reviews: number;
  total_comments: number;
  total_tickets: number;
  performance_users: number;
  total_brand_likes: number;
  brand_users: number;
  dau: number;
  wau: number;
  mau: number;
  completed_lessons: number;
  planned_lessons: number;
};

type SectionItem = {
  label: string;
  value: number;
  /** 주값을 쪼갠 내역. 합이 주값과 맞는 값만 넣는다. */
  breakdown?: { label: string; value: number }[];
};

function SectionCard({
  title,
  items,
}: {
  title: string;
  items: SectionItem[];
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
            <div key={item.label} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <div className="flex items-baseline gap-3">
                {/* 내역을 주값 앞에 둔다 — 주값이 어느 행이든 카드 오른쪽 끝에
                    서야 세로로 훑어 읽는 숫자 열이 깨지지 않는다. */}
                {item.breakdown && (
                  <span className="flex items-baseline gap-3 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                    {item.breakdown.map((part) => (
                      <span key={part.label}>
                        {part.label} {part.value.toLocaleString("ko-KR")}
                      </span>
                    ))}
                  </span>
                )}
                <span
                  className={`text-xl font-bold tabular-nums tracking-tight ${
                    item.value === 0 ? "text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {item.value.toLocaleString("ko-KR")}
                </span>
              </div>
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
          <SectionCardSkeleton rows={4} />
          <SectionCardSkeleton rows={2} />
          <SectionCardSkeleton rows={4} />
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
        {/* 활동 판정은 유저를 식별할 수 있는 모든 행동(기록, 티켓, 찜, 조회, 클릭,
            공지 읽기 등)을 합친 값이다. 앱에 들어와 아무것도 안 하고 나간 사람은
            잡히지 않는다 — 진입 자체를 남기는 테이블이 없기 때문이다.
            DAU는 오늘(KST), WAU는 최근 7일, MAU는 최근 30일 롤링이다. */}
        <SectionCard
          title="사용자"
          items={[
            { label: "총 가입자 수", value: stats.total_users },
            { label: "DAU", value: stats.dau },
            { label: "WAU", value: stats.wau },
            { label: "MAU", value: stats.mau },
          ]}
        />
        {/* records.status는 done과 planned 둘뿐이라 완료 + 예정 = 전체가 항상 성립한다. */}
        <SectionCard
          title="캘린더"
          items={[
            { label: "캘린더 사용자 수", value: stats.calendar_users },
            {
              label: "기록 등록 건수",
              value: stats.total_records,
              breakdown: [
                { label: "예정", value: stats.planned_lessons },
                { label: "완료", value: stats.completed_lessons },
              ],
            },
          ]}
        />
        {/* 공연 조회 수와 예매 클릭은 카드에서 뺐다 — 추세는 아래 공연 현황 차트에서 본다. */}
        <SectionCard
          title="공연"
          items={[
            { label: "공연 사용자 수", value: stats.performance_users },
            { label: "티켓 등록 건수", value: stats.total_tickets },
            { label: "리뷰 등록 건수", value: stats.total_reviews },
            { label: "댓글 등록 건수", value: stats.total_comments },
          ]}
        />
        {/* 브랜드 조회 수는 넣지 않는다 — brand_views는 링크 클릭 시 함께 기록되는
            인기 랭킹 점수라(lib/brandLinks.tsx) 조회수로 쓰면 오해를 부른다.
            외부 링크 클릭도 카드에서 뺐다 — 추세는 아래 브랜드 현황 차트에서 본다. */}
        <SectionCard
          title="브랜드"
          items={[
            { label: "브랜드 사용자 수", value: stats.brand_users },
            { label: "찜 건수", value: stats.total_brand_likes },
          ]}
        />
        <div className="md:col-span-2">
          <SignupTrendChart />
        </div>
        <div className="md:col-span-2">
          <CalendarTrendChart />
        </div>
        <div className="md:col-span-2">
          <PerformanceTrendChart />
        </div>
        <div className="md:col-span-2">
          <BrandTrendChart />
        </div>
      </div>
    </div>
  );
}

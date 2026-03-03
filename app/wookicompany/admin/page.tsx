"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, CalendarDays, FileText, MessageSquare, MessageCircle, UserCheck } from "lucide-react";

type Stats = {
  total_users: number;
  total_records: number;
  calendar_users: number;
  total_reviews: number;
  total_comments: number;
  performance_users: number;
};

const STAT_LABELS: { key: keyof Stats; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "total_users", label: "총 가입자 수", icon: Users },
  { key: "total_records", label: "캘린더 기록 등록 건 수", icon: FileText },
  { key: "calendar_users", label: "캘린더 사용자 수", icon: CalendarDays },
  { key: "total_reviews", label: "공연 리뷰 등록 건 수", icon: MessageSquare },
  { key: "total_comments", label: "공연 댓글 등록 건 수", icon: MessageCircle },
  { key: "performance_users", label: "공연 사용자 수", icon: UserCheck },
];

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
      setError(null);
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
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">대시보드</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">대시보드</h1>
        <p className="text-destructive">{error ?? "데이터가 없습니다."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">대시보드</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STAT_LABELS.map(({ key, label, icon: Icon }) => (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats[key].toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { getAdminToken } from "@/lib/adminUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type TrendRow = {
  date: string;
  view_count: number;
  booking_click_count: number;
};

// 볼륨이 큰 쪽을 진하게 둔다(누적 조회 131 대 예매 75).
const chartConfig = {
  view_count: { label: "공연 조회", color: "#17171c" },
  booking_click_count: { label: "예매 클릭", color: "#17171c73" },
} satisfies ChartConfig;

export default function PerformanceTrendChart() {
  const [period, setPeriod] = useState<"7" | "30">("7");
  const [data, setData] = useState<TrendRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (days: string) => {
    setLoading(true);
    const token = await getAdminToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/admin/stats/performance-trend?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json();
      setData(json.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(period); }, [period, fetchData]);

  const formatDate = (dateStr: string) => {
    const [, m, d] = dateStr.split("-");
    return `${parseInt(m)}/${parseInt(d)}`;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground">공연 현황</CardTitle>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as "7" | "30")}>
            <TabsList className="h-7">
              <TabsTrigger value="7" className="text-xs px-2 h-5">7일</TabsTrigger>
              <TabsTrigger value="30" className="text-xs px-2 h-5">30일</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="pb-4 pt-0">
        {loading ? (
          <Skeleton className="h-[180px] w-full" />
        ) : (
          <ChartContainer config={chartConfig} className="h-[180px] w-full">
            <LineChart data={data ?? []} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={period === "7" ? 0 : 4}
              />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(v) => formatDate(v as string)}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="view_count"
                stroke="#17171c"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="booking_click_count"
                stroke="#17171c"
                strokeWidth={2}
                strokeOpacity={0.45}
                dot={false}
                activeDot={{ r: 3 }}
              />
            </LineChart>
          </ChartContainer>
        )}
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-[#17171c]" />
            공연 조회
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-[#17171c] opacity-45" />
            예매 클릭
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

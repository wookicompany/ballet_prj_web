import { NextResponse } from "next/server";
import { format, subDays, parseISO } from "date-fns";

import { getAdminFromRequest } from "@/lib/apiAuth";
import { formatSeoulDateKey } from "@/lib/kstDateTime";

export const dynamic = "force-dynamic";

export const GET = async (request: Request) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) {
    return result.errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(Number(searchParams.get("days")) || 7, 1), 30);

  const { data, error } = await result.supabaseAdmin.rpc(
    "get_performance_daily_stats",
    { days }
  );

  if (error) {
    console.error("admin performance-trend", error);
    return NextResponse.json(
      { message: "Failed to fetch performance trend" },
      { status: 500 }
    );
  }

  const resultMap = new Map<string, { views: number; bookings: number }>(
    (data ?? []).map((row) => [
      row.stat_date,
      {
        views: Number(row.view_count),
        bookings: Number(row.booking_click_count),
      },
    ])
  );

  // 값이 없는 날은 0으로 채운다 — 빠진 날짜가 있으면 차트가 끊겨 보인다.
  const today = parseISO(formatSeoulDateKey());
  const trend = Array.from({ length: days }, (_, i) => {
    const date = format(subDays(today, days - 1 - i), "yyyy-MM-dd");
    const row = resultMap.get(date);
    return {
      date,
      view_count: row?.views ?? 0,
      booking_click_count: row?.bookings ?? 0,
    };
  });

  return NextResponse.json({ data: trend });
};

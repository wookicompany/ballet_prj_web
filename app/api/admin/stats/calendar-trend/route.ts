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

  const { data, error } = await result.supabaseAdmin.rpc("get_calendar_daily_stats", { days });

  if (error) {
    console.error("admin calendar-trend", error);
    return NextResponse.json({ message: "Failed to fetch calendar trend" }, { status: 500 });
  }

  const resultMap = new Map<string, { record_count: number; unique_users: number }>(
    (data ?? []).map((row) => [row.stat_date, { record_count: Number(row.record_count), unique_users: Number(row.unique_users) }])
  );

  const today = parseISO(formatSeoulDateKey());
  const trend = Array.from({ length: days }, (_, i) => {
    const date = format(subDays(today, days - 1 - i), "yyyy-MM-dd");
    return {
      date,
      record_count: resultMap.get(date)?.record_count ?? 0,
      unique_users: resultMap.get(date)?.unique_users ?? 0,
    };
  });

  return NextResponse.json({ data: trend });
};

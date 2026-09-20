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
    "get_brand_daily_stats",
    { days }
  );

  if (error) {
    console.error("admin brand-trend", error);
    return NextResponse.json(
      { message: "Failed to fetch brand trend" },
      { status: 500 }
    );
  }

  // 찜은 그날 누른 횟수를 센다(취소분 포함). 나중에 취소했다고 과거 추세가 바뀌면
  // 그래프를 읽을 수 없기 때문이다. 카드의 "찜 건수"는 반대로 현재 유효한 것만 센다.
  const resultMap = new Map<string, { clicks: number; likes: number }>(
    (data ?? []).map((row) => [
      row.stat_date,
      {
        clicks: Number(row.link_click_count),
        likes: Number(row.like_count),
      },
    ])
  );

  const today = parseISO(formatSeoulDateKey());
  const trend = Array.from({ length: days }, (_, i) => {
    const date = format(subDays(today, days - 1 - i), "yyyy-MM-dd");
    const row = resultMap.get(date);
    return {
      date,
      link_click_count: row?.clicks ?? 0,
      like_count: row?.likes ?? 0,
    };
  });

  return NextResponse.json({ data: trend });
};

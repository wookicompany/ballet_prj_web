import { NextResponse } from "next/server";

import {
  fetchKopisDetail,
  fetchKopisListPage,
  mapKopisDetailItem,
  mapKopisListItem,
} from "@/lib/kopis";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const KOPIS_PAGE_SIZE = 100;

const getRequiredEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
};

const getDateKey = (value: Date) =>
  value.toISOString().slice(0, 10).replace(/-/g, "");

const getDefaultDateRange = () => {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 30);
  const end = new Date(now);
  end.setDate(end.getDate() + 365);
  return {
    stdate: getDateKey(start),
    eddate: getDateKey(end),
  };
};

const getAfterDate = () => {
  const now = new Date();
  const after = new Date(now);
  after.setDate(after.getDate() - 3);
  return getDateKey(after);
};

const chunk = <T,>(list: T[], size: number) => {
  const result: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    result.push(list.slice(i, i + size));
  }
  return result;
};

const requireCronSecret = (request: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;
  const header = request.headers.get("x-cron-secret");
  if (header !== secret) {
    throw new Error("Invalid cron secret");
  }
};

export async function POST(request: Request) {
  try {
    requireCronSecret(request);
    const serviceKey = getRequiredEnv("KOPIS_API_KEY");

    const url = new URL(request.url);
    const stdate = url.searchParams.get("stdate");
    const eddate = url.searchParams.get("eddate");
    const afterdate = url.searchParams.get("afterdate") ?? getAfterDate();
    const { stdate: defaultStart, eddate: defaultEnd } = getDefaultDateRange();

    const rangeStart = stdate ?? defaultStart;
    const rangeEnd = eddate ?? defaultEnd;

    let page = 1;
    let listItems: Awaited<ReturnType<typeof fetchKopisListPage>> = [];
    const listRecords: ReturnType<typeof mapKopisListItem>[] = [];

    while (true) {
      listItems = await fetchKopisListPage({
        serviceKey,
        stdate: rangeStart,
        eddate: rangeEnd,
        page,
        rows: KOPIS_PAGE_SIZE,
        afterdate,
      });

      if (!listItems.length) break;

      const mapped = listItems.map(mapKopisListItem).filter((item) => item.mt20id);
      listRecords.push(...mapped);

      if (listItems.length < KOPIS_PAGE_SIZE) break;
      page += 1;
    }

    if (listRecords.length) {
      const { error } = await supabaseAdmin
        .from("kopis_performances")
        .upsert(listRecords, { onConflict: "mt20id" });
      if (error) throw error;
    }

    const detailIds = listRecords
      .map((item) => item.mt20id)
      .filter((id): id is string => Boolean(id));

    const detailRecords: ReturnType<typeof mapKopisDetailItem>[] = [];
    const idChunks = chunk(detailIds, 10);

    for (const ids of idChunks) {
      const details = await Promise.all(
        ids.map((id) => fetchKopisDetail(serviceKey, id)),
      );
      details
        .filter((detail): detail is NonNullable<typeof detail> => Boolean(detail))
        .forEach((detail) => {
          detailRecords.push(mapKopisDetailItem(detail));
        });
    }

    if (detailRecords.length) {
      const { error } = await supabaseAdmin
        .from("kopis_performance_details")
        .upsert(detailRecords, { onConflict: "mt20id" });
      if (error) throw error;
    }

    return NextResponse.json({
      ok: true,
      range: { stdate: rangeStart, eddate: rangeEnd, afterdate },
      counts: {
        list: listRecords.length,
        detail: detailRecords.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

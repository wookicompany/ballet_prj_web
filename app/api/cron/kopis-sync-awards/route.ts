import { NextResponse } from "next/server";

import { fetchKopisAwardsListPage, mapKopisAwardItem } from "@/lib/kopis";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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

const normalizeAfterDate = (value: string | null) => {
  if (value === null) return getAfterDate();
  const normalized = value.trim().toLowerCase();
  if (!normalized || ["0", "off", "none"].includes(normalized)) {
    return undefined;
  }
  return value;
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
    const supabaseAdmin = getSupabaseAdmin();
    const serviceKey = getRequiredEnv("KOPIS_API_KEY");

    const url = new URL(request.url);
    const stdate = url.searchParams.get("stdate");
    const eddate = url.searchParams.get("eddate");
    const afterdate = normalizeAfterDate(url.searchParams.get("afterdate"));
    const { stdate: defaultStart, eddate: defaultEnd } = getDefaultDateRange();

    const rangeStart = stdate ?? defaultStart;
    const rangeEnd = eddate ?? defaultEnd;

    let page = 1;
    const records: (ReturnType<typeof mapKopisAwardItem> & {
      mt20id: string;
    })[] = [];

    while (true) {
      const listItems = await fetchKopisAwardsListPage({
        serviceKey,
        stdate: rangeStart,
        eddate: rangeEnd,
        page,
        rows: KOPIS_PAGE_SIZE,
        afterdate,
      });

      if (!listItems.length) break;

      const mapped = listItems
        .map(mapKopisAwardItem)
        .filter(
          (
            item,
          ): item is ReturnType<typeof mapKopisAwardItem> & {
            mt20id: string;
          } => Boolean(item.mt20id),
        );
      records.push(...mapped);

      if (listItems.length < KOPIS_PAGE_SIZE) break;
      page += 1;
    }

    if (records.length) {
      const { error } = await supabaseAdmin
        .from("kopis_performance_awards")
        .upsert(records, { onConflict: "mt20id" });
      if (error) throw error;
    }

    return NextResponse.json({
      ok: true,
      range: { stdate: rangeStart, eddate: rangeEnd, afterdate },
      count: records.length,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : JSON.stringify(error);
    return NextResponse.json(
      {
        ok: false,
        error: message || "Unknown error",
      },
      { status: 500 },
    );
  }
}

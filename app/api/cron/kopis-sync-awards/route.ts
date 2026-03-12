import { NextResponse } from "next/server";

import {
  assertCronAuthorized,
  CronAuthError,
  getSeoulYear,
  isCronActiveYear,
} from "@/lib/cronAuth";
import { finishCronRun, startCronRun } from "@/lib/cronRunLogger";
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
  const end = new Date(now);
  end.setDate(end.getDate() + 365);
  return {
    stdate: getDateKey(start),
    eddate: getDateKey(end),
  };
};

const normalizeAfterDate = (value: string | null) => {
  if (value === null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized || ["0", "off", "none"].includes(normalized)) {
    return undefined;
  }
  return value;
};

const JOB_NAME = "kopis-sync-awards";
const SCHEDULED_SLOT = "03:30(KST)";

const run = async (request: Request) => {
  assertCronAuthorized(request);
  if (!isCronActiveYear()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `CRON_ACTIVE_YEAR=${process.env.CRON_ACTIVE_YEAR}, current_year=${getSeoulYear()}(KST)`,
    });
  }
  const runId = await startCronRun({
    jobName: JOB_NAME,
    scheduledSlot: SCHEDULED_SLOT,
  });

  try {
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

    const payload = {
      ok: true,
      range: { stdate: rangeStart, eddate: rangeEnd, afterdate },
      counts: { list: records.length },
    };

    await finishCronRun({
      runId,
      status: "success",
      counts: payload.counts,
    });

    return NextResponse.json(payload);
  } catch (error) {
    await finishCronRun({
      runId,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    }).catch(() => {});

    if (error instanceof CronAuthError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: error.status }
      );
    }

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
};

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}

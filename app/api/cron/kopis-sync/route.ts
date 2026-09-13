import { NextResponse } from "next/server";

import {
  fetchKopisDetail,
  fetchKopisListPage,
  mapKopisDetailItem,
  mapKopisListItem,
} from "@/lib/kopis";
import {
  assertCronAuthorized,
  CronAuthError,
  getSeoulYear,
  isCronActiveYear,
} from "@/lib/cronAuth";
import { finishCronRun, startCronRun } from "@/lib/cronRunLogger";
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

const chunk = <T,>(list: T[], size: number) => {
  const result: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    result.push(list.slice(i, i + size));
  }
  return result;
};

const JOB_NAME = "kopis-sync";
const SCHEDULED_SLOT = "03:00(KST)";

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
    let listItems: Awaited<ReturnType<typeof fetchKopisListPage>> = [];
    const listRecords: (ReturnType<typeof mapKopisListItem> & {
      mt20id: string;
      prfnm: string;
    })[] = [];

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

      const mapped = listItems
        .map(mapKopisListItem)
        .filter(
          (
            item
          ): item is ReturnType<typeof mapKopisListItem> & {
            mt20id: string;
            prfnm: string;
          } => Boolean(item.mt20id) && Boolean(item.prfnm)
        );
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

    const detailRecords: (ReturnType<typeof mapKopisDetailItem> & {
      mt20id: string;
    })[] = [];
    const idChunks = chunk(detailIds, 10);

    for (const ids of idChunks) {
      const details = await Promise.all(
        ids.map((id) => fetchKopisDetail(serviceKey, id)),
      );
      details
        .filter((detail): detail is NonNullable<typeof detail> => Boolean(detail))
        .forEach((detail) => {
          const mapped = mapKopisDetailItem(detail);
          if (mapped.mt20id) {
            detailRecords.push({ ...mapped, mt20id: mapped.mt20id });
          }
        });
    }

    if (detailRecords.length) {
      const { error } = await supabaseAdmin
        .from("kopis_performance_details")
        .upsert(detailRecords, { onConflict: "mt20id" });
      if (error) throw error;
    }

    const payload = {
      ok: true,
      range: { stdate: rangeStart, eddate: rangeEnd, afterdate },
      counts: {
        list: listRecords.length,
        detail: detailRecords.length,
      },
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

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
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

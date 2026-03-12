import { NextResponse } from "next/server";

import {
  fetchKopisFacilityDetail,
  fetchKopisFacilityListPage,
  mapKopisFacilityDetailItem,
  mapKopisFacilityListItem,
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

const JOB_NAME = "kopis-sync-facilities";
const SCHEDULED_SLOT = "04:00(KST)";

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
    const afterdate = normalizeAfterDate(url.searchParams.get("afterdate"));

    let page = 1;
    let listItems: Awaited<ReturnType<typeof fetchKopisFacilityListPage>> = [];
    const listRecords: (ReturnType<typeof mapKopisFacilityListItem> & {
      mt10id: string;
      fcltynm: string;
    })[] = [];

    while (true) {
      listItems = await fetchKopisFacilityListPage({
        serviceKey,
        page,
        rows: KOPIS_PAGE_SIZE,
        afterdate,
      });

      if (!listItems.length) break;

      const mapped = listItems
        .map(mapKopisFacilityListItem)
        .filter(
          (
            item
          ): item is ReturnType<typeof mapKopisFacilityListItem> & {
            mt10id: string;
            fcltynm: string;
          } => Boolean(item.mt10id) && Boolean(item.fcltynm),
        );
      listRecords.push(...mapped);

      if (listItems.length < KOPIS_PAGE_SIZE) break;
      page += 1;
    }

    if (listRecords.length) {
      const { error } = await supabaseAdmin
        .from("kopis_facilities")
        .upsert(listRecords, { onConflict: "mt10id" });
      if (error) throw error;
    }

    const detailIds = listRecords
      .map((item) => item.mt10id)
      .filter((id): id is string => Boolean(id));

    const detailRecords: (ReturnType<typeof mapKopisFacilityDetailItem> & {
      mt10id: string;
    })[] = [];
    const idChunks = chunk(detailIds, 10);

    for (const ids of idChunks) {
      const details = await Promise.all(
        ids.map((id) => fetchKopisFacilityDetail(serviceKey, id)),
      );
      details
        .filter((detail): detail is NonNullable<typeof detail> => Boolean(detail))
        .forEach((detail) => {
          const mapped = mapKopisFacilityDetailItem(detail);
          if (mapped.mt10id) {
            detailRecords.push({ ...mapped, mt10id: mapped.mt10id });
          }
        });
    }

    if (detailRecords.length) {
      const { error } = await supabaseAdmin
        .from("kopis_facility_details")
        .upsert(detailRecords, { onConflict: "mt10id" });
      if (error) throw error;
    }

    const payload = {
      ok: true,
      range: { afterdate },
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

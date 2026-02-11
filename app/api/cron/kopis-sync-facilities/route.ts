import { NextResponse } from "next/server";

import {
  fetchKopisFacilityDetail,
  fetchKopisFacilityListPage,
  mapKopisFacilityDetailItem,
  mapKopisFacilityListItem,
} from "@/lib/kopis";
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

    return NextResponse.json({
      ok: true,
      range: { afterdate },
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

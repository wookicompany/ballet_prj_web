import { NextResponse } from "next/server";

import { getAdminFromRequest } from "@/lib/apiAuth";
import { AD_PLACEMENTS, AD_PROVIDER, isAdPlacement } from "@/lib/ads";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

type CreateAdBody = {
  placement?: string;
  title?: string;
  description?: string | null;
  is_active?: boolean;
};

const ADSENSE_DEFAULT_START_AT = "2000-01-01T00:00:00.000Z";
const ADSENSE_DEFAULT_END_AT = "2099-12-31T23:59:59.999Z";

const getDefaultTitle = (placement: string) => {
  if (placement === "calendar_home") return "캘린더 탭 홈 AdSense";
  if (placement === "profile_home") return "프로필 탭 홈 AdSense";
  return "공연 탭 홈 AdSense";
};

const hasOverlappingActiveAd = async ({
  supabaseAdmin,
  placement,
  startAtIso,
  endAtIso,
}: {
  supabaseAdmin: Extract<
    Awaited<ReturnType<typeof getAdminFromRequest>>,
    { admin: true }
  >["supabaseAdmin"];
  placement: string;
  startAtIso: string;
  endAtIso: string;
}) => {
  const { data, error } = await supabaseAdmin
    .from("ads")
    .select("id")
    .eq("placement", placement)
    .eq("is_active", true)
    .lt("start_at", endAtIso)
    .gt("end_at", startAtIso)
    .limit(1);
  if (error) return { error };
  return { exists: !!(data && data.length > 0) };
};

export const GET = async (request: Request) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) return result.errorResponse;

  const { data: existingSlots, error: existingSlotsError } = await result.supabaseAdmin
    .from("ads")
    .select("placement");
  if (existingSlotsError) {
    console.error("admin ads list placements", existingSlotsError);
    return NextResponse.json({ message: "Failed to list ads" }, { status: 500 });
  }

  const existingPlacementSet = new Set(
    (existingSlots ?? []).map((row) => row.placement)
  );
  const missingPlacements = AD_PLACEMENTS.filter(
    (placement) => !existingPlacementSet.has(placement)
  );

  if (missingPlacements.length > 0) {
    const { error: seedError } = await result.supabaseAdmin.from("ads").insert(
      missingPlacements.map((placement) => ({
        placement,
        provider: AD_PROVIDER,
        title: getDefaultTitle(placement),
        description: null,
        is_active: false,
        start_at: ADSENSE_DEFAULT_START_AT,
        end_at: ADSENSE_DEFAULT_END_AT,
      }))
    );
    if (seedError) {
      console.error("admin ads seed placements", seedError);
      return NextResponse.json({ message: "Failed to prepare ad slots" }, { status: 500 });
    }
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    Number(searchParams.get("limit")) || DEFAULT_LIMIT,
    MAX_LIMIT
  );
  const offset = Number(searchParams.get("offset")) || 0;

  const { data: rows, error } = await result.supabaseAdmin
    .from("ads")
    .select(
      "id, placement, provider, title, description, is_active, start_at, end_at, click_count, last_clicked_at, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("admin ads list", error);
    return NextResponse.json({ message: "Failed to list ads" }, { status: 500 });
  }

  const { count } = await result.supabaseAdmin
    .from("ads")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({
    ads: rows ?? [],
    total: count ?? 0,
    limit,
    offset,
  });
};

export const POST = async (request: Request) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) return result.errorResponse;

  let body: CreateAdBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const placement = body.placement;
  if (!placement || !isAdPlacement(placement)) {
    return NextResponse.json({ message: "invalid placement" }, { status: 400 });
  }
  const title = body.title?.trim() || getDefaultTitle(placement);
  const description = body.description?.trim() || null;
  const startAtIso = ADSENSE_DEFAULT_START_AT;
  const endAtIso = ADSENSE_DEFAULT_END_AT;

  const isActive = body.is_active === true;
  if (isActive) {
    const overlap = await hasOverlappingActiveAd({
      supabaseAdmin: result.supabaseAdmin,
      placement,
      startAtIso,
      endAtIso,
    });
    if ("error" in overlap) {
      console.error("admin ads overlap check", overlap.error);
      return NextResponse.json(
        { message: "Failed to validate ad schedule" },
        { status: 500 }
      );
    }
    if (overlap.exists) {
      return NextResponse.json(
        { message: "동일 슬롯에 이미 활성화된 광고가 존재합니다." },
        { status: 409 }
      );
    }
  }

  const { data: ad, error } = await result.supabaseAdmin
    .from("ads")
    .insert({
      placement,
      provider: AD_PROVIDER,
      title,
      description,
      is_active: isActive,
      start_at: startAtIso,
      end_at: endAtIso,
    })
    .select()
    .single();

  if (error) {
    console.error("admin ads create", error);
    return NextResponse.json({ message: "Failed to create ad" }, { status: 500 });
  }

  return NextResponse.json({ ad });
};

import { NextResponse } from "next/server";

import { getAdminFromRequest } from "@/lib/apiAuth";
import { isAdPlacement, parseKstDateTimeInputToIso } from "@/lib/ads";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

type CreateAdBody = {
  placement?: string;
  title?: string;
  description?: string | null;
  is_active?: boolean;
  image_url?: string | null;
  link_url?: string | null;
  height?: number;
  start_at?: string;
  end_at?: string;
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

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    Number(searchParams.get("limit")) || DEFAULT_LIMIT,
    MAX_LIMIT
  );
  const offset = Number(searchParams.get("offset")) || 0;
  const placement = searchParams.get("placement") ?? undefined;

  let query = result.supabaseAdmin
    .from("ads")
    .select(
      "id, placement, provider, title, description, is_active, start_at, end_at, image_url, link_url, height, click_count, last_clicked_at, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  if (placement) {
    query = query.eq("placement", placement);
  }

  const [{ data: rows, error }, { count }] = await Promise.all([
    query.range(offset, offset + limit - 1),
    result.supabaseAdmin
      .from("ads")
      .select("id", { count: "exact", head: true }),
  ]);

  if (error) {
    console.error("admin ads list", error);
    return NextResponse.json({ message: "Failed to list ads" }, { status: 500 });
  }

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

  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ message: "title is required" }, { status: 400 });
  }

  const startAtRaw = body.start_at;
  const endAtRaw = body.end_at;
  if (!startAtRaw || !endAtRaw) {
    return NextResponse.json(
      { message: "start_at and end_at are required" },
      { status: 400 }
    );
  }
  const startAtIso = parseKstDateTimeInputToIso(startAtRaw);
  const endAtIso = parseKstDateTimeInputToIso(endAtRaw);
  if (!startAtIso || !endAtIso) {
    return NextResponse.json(
      { message: "invalid start_at or end_at format" },
      { status: 400 }
    );
  }
  if (startAtIso >= endAtIso) {
    return NextResponse.json(
      { message: "end_at must be after start_at" },
      { status: 400 }
    );
  }

  const description = body.description?.trim() || null;
  const imageUrl = body.image_url?.trim() || null;
  const linkUrl = body.link_url?.trim() || null;
  const height = body.height === 100 ? 100 : 50;
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
      title,
      description,
      is_active: isActive,
      start_at: startAtIso,
      end_at: endAtIso,
      image_url: imageUrl,
      link_url: linkUrl,
      height,
    })
    .select()
    .single();

  if (error) {
    console.error("admin ads create", error);
    return NextResponse.json({ message: "Failed to create ad" }, { status: 500 });
  }

  return NextResponse.json({ ad });
};

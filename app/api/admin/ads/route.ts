import { NextResponse } from "next/server";

import { getAdminFromRequest } from "@/lib/apiAuth";
import {
  AD_PROVIDER,
  isAdPlacement,
  isValidHttpUrl,
  parseKstDateTimeInputToIso,
} from "@/lib/ads";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

type CreateAdBody = {
  placement?: string;
  title?: string;
  description?: string | null;
  image_url?: string;
  target_url?: string;
  is_active?: boolean;
  start_at?: string;
  end_at?: string;
};

const hasOverlappingActiveAd = async ({
  supabaseAdmin,
  placement,
  startAtIso,
  endAtIso,
}: {
  supabaseAdmin: Awaited<
    ReturnType<typeof getAdminFromRequest>
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

  const { data: rows, error } = await result.supabaseAdmin
    .from("ads")
    .select(
      "id, placement, provider, title, description, image_url, target_url, is_active, start_at, end_at, click_count, last_clicked_at, created_at, updated_at"
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

  const title = body.title?.trim();
  const imageUrl = body.image_url?.trim();
  const targetUrl = body.target_url?.trim();
  const description = body.description?.trim() || null;
  if (!title || !imageUrl || !targetUrl || !body.start_at || !body.end_at) {
    return NextResponse.json(
      { message: "required fields are missing" },
      { status: 400 }
    );
  }
  if (!isAdPlacement(body.placement ?? "")) {
    return NextResponse.json({ message: "invalid placement" }, { status: 400 });
  }
  if (!isValidHttpUrl(imageUrl) || !isValidHttpUrl(targetUrl)) {
    return NextResponse.json(
      { message: "image_url and target_url must be valid http/https urls" },
      { status: 400 }
    );
  }

  const startAtIso = parseKstDateTimeInputToIso(body.start_at);
  const endAtIso = parseKstDateTimeInputToIso(body.end_at);
  if (!startAtIso || !endAtIso) {
    return NextResponse.json(
      { message: "start_at and end_at must be KST datetime-local format" },
      { status: 400 }
    );
  }
  if (startAtIso >= endAtIso) {
    return NextResponse.json(
      { message: "end_at must be after start_at" },
      { status: 400 }
    );
  }

  const isActive = body.is_active === true;
  if (isActive) {
    const overlap = await hasOverlappingActiveAd({
      supabaseAdmin: result.supabaseAdmin,
      placement: body.placement,
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
      placement: body.placement,
      provider: AD_PROVIDER,
      title,
      description,
      image_url: imageUrl,
      target_url: targetUrl,
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

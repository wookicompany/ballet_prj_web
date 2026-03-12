import { NextResponse } from "next/server";

import { getAdminFromRequest } from "@/lib/apiAuth";
import { isAdPlacement, parseKstDateTimeInputToIso } from "@/lib/ads";

export const dynamic = "force-dynamic";

type UpdateAdBody = {
  placement?: string;
  title?: string;
  description?: string | null;
  is_active?: boolean;
  start_at?: string;
  end_at?: string;
};

const hasOverlappingActiveAd = async ({
  supabaseAdmin,
  adId,
  placement,
  startAtIso,
  endAtIso,
}: {
  supabaseAdmin: Extract<
    Awaited<ReturnType<typeof getAdminFromRequest>>,
    { admin: true }
  >["supabaseAdmin"];
  adId: string;
  placement: string;
  startAtIso: string;
  endAtIso: string;
}) => {
  const { data, error } = await supabaseAdmin
    .from("ads")
    .select("id")
    .eq("placement", placement)
    .eq("is_active", true)
    .neq("id", adId)
    .lt("start_at", endAtIso)
    .gt("end_at", startAtIso)
    .limit(1);
  if (error) return { error };
  return { exists: !!(data && data.length > 0) };
};

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) return result.errorResponse;

  const { id } = await params;
  const { data: ad, error } = await result.supabaseAdmin
    .from("ads")
    .select(
      "id, placement, provider, title, description, is_active, start_at, end_at, click_count, last_clicked_at, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("admin ads get", error);
    return NextResponse.json({ message: "Failed to load ad" }, { status: 500 });
  }
  if (!ad) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ad });
};

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) return result.errorResponse;

  const { id } = await params;
  const { data: existing, error: fetchError } = await result.supabaseAdmin
    .from("ads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  let body: UpdateAdBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, string | boolean | null> = {
    updated_at: new Date().toISOString(),
  };

  let nextPlacement = existing.placement as string;
  let nextStartAt = existing.start_at as string;
  let nextEndAt = existing.end_at as string;
  let nextIsActive = existing.is_active as boolean;

  if (typeof body.placement === "string") {
    if (!isAdPlacement(body.placement)) {
      return NextResponse.json({ message: "invalid placement" }, { status: 400 });
    }
    updates.placement = body.placement;
    nextPlacement = body.placement;
  }
  if (typeof body.title === "string") {
    const trimmed = body.title.trim();
    if (!trimmed) {
      return NextResponse.json({ message: "title is required" }, { status: 400 });
    }
    updates.title = trimmed;
  }
  if (typeof body.description === "string" || body.description === null) {
    updates.description = body.description?.trim() || null;
  }
  if (typeof body.start_at === "string") {
    const startAtIso = parseKstDateTimeInputToIso(body.start_at);
    if (!startAtIso) {
      return NextResponse.json({ message: "invalid start_at" }, { status: 400 });
    }
    updates.start_at = startAtIso;
    nextStartAt = startAtIso;
  }
  if (typeof body.end_at === "string") {
    const endAtIso = parseKstDateTimeInputToIso(body.end_at);
    if (!endAtIso) {
      return NextResponse.json({ message: "invalid end_at" }, { status: 400 });
    }
    updates.end_at = endAtIso;
    nextEndAt = endAtIso;
  }
  if (typeof body.is_active === "boolean") {
    updates.is_active = body.is_active;
    nextIsActive = body.is_active;
  }

  if (nextStartAt >= nextEndAt) {
    return NextResponse.json(
      { message: "end_at must be after start_at" },
      { status: 400 }
    );
  }

  if (nextIsActive) {
    const overlap = await hasOverlappingActiveAd({
      supabaseAdmin: result.supabaseAdmin,
      adId: id,
      placement: nextPlacement,
      startAtIso: nextStartAt,
      endAtIso: nextEndAt,
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
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("admin ads patch", error);
    return NextResponse.json({ message: "Failed to update ad" }, { status: 500 });
  }
  return NextResponse.json({ ad });
};

export const DELETE = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) return result.errorResponse;

  const { id } = await params;
  const { error } = await result.supabaseAdmin.from("ads").delete().eq("id", id);
  if (error) {
    console.error("admin ads delete", error);
    return NextResponse.json({ message: "Failed to delete ad" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
};

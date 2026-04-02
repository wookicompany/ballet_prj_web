import { NextResponse } from "next/server";

import { getAdminFromRequest } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) {
    return result.errorResponse;
  }

  const { id } = await params;

  const { data: brand, error } = await result.supabaseAdmin
    .from("ballet_brands")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("admin brand get", error);
    return NextResponse.json({ message: "Failed to load brand" }, { status: 500 });
  }

  if (!brand) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ brand });
};

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) {
    return result.errorResponse;
  }

  const { id } = await params;

  const { data: existing, error: fetchError } = await result.supabaseAdmin
    .from("ballet_brands")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  let body: {
    name_ko?: string;
    name_en?: string | null;
    logo_url?: string | null;
    website_url?: string | null;
    instagram_url?: string | null;
    facebook_url?: string | null;
    threads_url?: string | null;
    youtube_url?: string | null;
    x_url?: string | null;
    naver_blog_url?: string | null;
    tiktok_url?: string | null;
    is_active?: boolean;
    sort_order?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.name_ko === "string") {
    const v = body.name_ko.trim();
    if (v) updates.name_ko = v;
  }
  const nullableStrings = [
    "name_en",
    "logo_url",
    "website_url",
    "instagram_url",
    "facebook_url",
    "threads_url",
    "youtube_url",
    "x_url",
    "naver_blog_url",
    "tiktok_url",
  ] as const;
  for (const key of nullableStrings) {
    if (key in body) {
      updates[key] = body[key] ? String(body[key]).trim() || null : null;
    }
  }
  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
  if (typeof body.sort_order === "number") updates.sort_order = body.sort_order;

  const { data: brand, error: updateError } = await result.supabaseAdmin
    .from("ballet_brands")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    console.error("admin brand patch", updateError);
    return NextResponse.json({ message: "Failed to update brand" }, { status: 500 });
  }

  return NextResponse.json({ brand });
};

export const DELETE = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) {
    return result.errorResponse;
  }

  const { id } = await params;

  const { error } = await result.supabaseAdmin
    .from("ballet_brands")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("admin brand delete", error);
    return NextResponse.json({ message: "Failed to delete brand" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
};

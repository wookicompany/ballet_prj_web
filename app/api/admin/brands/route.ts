import { NextResponse } from "next/server";

import { getAdminFromRequest } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const GET = async (request: Request) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) {
    return result.errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    Number(searchParams.get("limit")) || DEFAULT_LIMIT,
    MAX_LIMIT
  );
  const offset = Number(searchParams.get("offset")) || 0;
  const q = searchParams.get("q")?.trim() || "";

  let query = result.supabaseAdmin
    .from("ballet_brands")
    .select(
      "id, name_ko, name_en, logo_url, is_active, sort_order, created_at, updated_at"
    )
    .order("name_ko", { ascending: true });
  if (q) {
    query = query.or(`name_ko.ilike.%${q}%,name_en.ilike.%${q}%`);
  }

  let countQuery = result.supabaseAdmin
    .from("ballet_brands")
    .select("id", { count: "exact", head: true });
  if (q) {
    countQuery = countQuery.or(`name_ko.ilike.%${q}%,name_en.ilike.%${q}%`);
  }

  const [{ data: rows, error }, { count }] = await Promise.all([
    query.range(offset, offset + limit - 1),
    countQuery,
  ]);

  if (error) {
    console.error("admin brands list", error);
    return NextResponse.json({ message: "Failed to list brands" }, { status: 500 });
  }

  return NextResponse.json({
    brands: rows ?? [],
    total: count ?? 0,
    limit,
    offset,
  });
};

export const POST = async (request: Request) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) {
    return result.errorResponse;
  }

  let body: {
    name_ko?: string;
    name_en?: string;
    logo_url?: string;
    website_url?: string;
    instagram_url?: string;
    facebook_url?: string;
    threads_url?: string;
    youtube_url?: string;
    x_url?: string;
    naver_blog_url?: string;
    tiktok_url?: string;
    is_active?: boolean;
    sort_order?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const name_ko = body.name_ko?.trim();
  if (!name_ko) {
    return NextResponse.json({ message: "name_ko is required" }, { status: 400 });
  }

  const { data: brand, error } = await result.supabaseAdmin
    .from("ballet_brands")
    .insert({
      name_ko,
      name_en: body.name_en?.trim() || null,
      logo_url: body.logo_url?.trim() || null,
      website_url: body.website_url?.trim() || null,
      instagram_url: body.instagram_url?.trim() || null,
      facebook_url: body.facebook_url?.trim() || null,
      threads_url: body.threads_url?.trim() || null,
      youtube_url: body.youtube_url?.trim() || null,
      x_url: body.x_url?.trim() || null,
      naver_blog_url: body.naver_blog_url?.trim() || null,
      tiktok_url: body.tiktok_url?.trim() || null,
      is_active: body.is_active !== false,
      sort_order: typeof body.sort_order === "number" ? body.sort_order : 0,
    })
    .select()
    .single();

  if (error) {
    console.error("admin brands create", error);
    return NextResponse.json({ message: "Failed to create brand" }, { status: 500 });
  }

  return NextResponse.json({ brand }, { status: 201 });
};

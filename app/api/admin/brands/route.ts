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
  const sort = searchParams.get("sort") || "name_ko"; // "name_ko" | "view_count_desc" | "view_count_asc" | "like_count_desc" | "like_count_asc"

  const isSortByView = sort === "view_count_desc" || sort === "view_count_asc";
  const isSortByLike = sort === "like_count_desc" || sort === "like_count_asc";

  if (isSortByView || isSortByLike) {
    // 1. 검색 조건에 맞는 모든 브랜드 ID 조회
    let allIdsQuery = result.supabaseAdmin
      .from("ballet_brands")
      .select("id");
    if (q) allIdsQuery = allIdsQuery.or(`name_ko.ilike.%${q}%,name_en.ilike.%${q}%`);
    const { data: allIdRows, error: idError } = await allIdsQuery;
    if (idError) {
      console.error("admin brands list", idError);
      return NextResponse.json({ message: "Failed to list brands" }, { status: 500 });
    }
    const allIds = (allIdRows ?? []).map((r) => r.id);
    const total = allIds.length;

    // 2. 조회수 + 찜수 병렬 조회
    const [{ data: viewRows }, { data: likeRows }] = await Promise.all([
      allIds.length
        ? result.supabaseAdmin
            .from("brand_engagement_summaries")
            .select("brand_id, view_count")
            .in("brand_id", allIds)
        : Promise.resolve({ data: [] }),
      allIds.length
        ? result.supabaseAdmin
            .from("brand_likes")
            .select("brand_id")
            .in("brand_id", allIds)
            .is("deleted_at", null)
        : Promise.resolve({ data: [] }),
    ]);

    const viewCountMap: Record<string, number> = {};
    for (const row of viewRows ?? []) {
      if (row.brand_id) viewCountMap[row.brand_id] = row.view_count ?? 0;
    }
    const likeCountMap: Record<string, number> = {};
    for (const row of likeRows ?? []) {
      if (row.brand_id) likeCountMap[row.brand_id] = (likeCountMap[row.brand_id] ?? 0) + 1;
    }

    // 3. 기준 컬럼으로 정렬 후 페이지네이션
    const sortedIds = [...allIds].sort((a, b) => {
      if (isSortByLike) {
        const diff = (likeCountMap[a] ?? 0) - (likeCountMap[b] ?? 0);
        return sort === "like_count_desc" ? -diff : diff;
      }
      const diff = (viewCountMap[a] ?? 0) - (viewCountMap[b] ?? 0);
      return sort === "view_count_desc" ? -diff : diff;
    });
    const pageIds = sortedIds.slice(offset, offset + limit);

    if (pageIds.length === 0) {
      return NextResponse.json({ brands: [], total, limit, offset });
    }

    // 4. 페이지 브랜드 상세 조회
    const { data: rows, error } = await result.supabaseAdmin
      .from("ballet_brands")
      .select("id, name_ko, name_en, logo_url, is_active, sort_order, created_at, updated_at")
      .in("id", pageIds);

    if (error) {
      console.error("admin brands list", error);
      return NextResponse.json({ message: "Failed to list brands" }, { status: 500 });
    }

    // 5. 정렬 순서 복원 후 view_count·like_count 병합
    const rowMap = Object.fromEntries((rows ?? []).map((r) => [r.id, r]));
    const brands = pageIds
      .map((id) => rowMap[id])
      .filter(Boolean)
      .map((row) => ({
        ...row,
        view_count: viewCountMap[row.id] ?? 0,
        like_count: likeCountMap[row.id] ?? 0,
      }));

    return NextResponse.json({ brands, total, limit, offset });
  }

  // 기본 정렬: 가나다순
  let query = result.supabaseAdmin
    .from("ballet_brands")
    .select("id, name_ko, name_en, logo_url, is_active, sort_order, created_at, updated_at")
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

  const brandIds = (rows ?? []).map((r) => r.id);
  const [{ data: viewRows }, { data: likeRows }] = await Promise.all([
    brandIds.length
      ? result.supabaseAdmin
          .from("brand_engagement_summaries")
          .select("brand_id, view_count")
          .in("brand_id", brandIds)
      : Promise.resolve({ data: [] }),
    brandIds.length
      ? result.supabaseAdmin
          .from("brand_likes")
          .select("brand_id")
          .in("brand_id", brandIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] }),
  ]);

  const viewCountMap: Record<string, number> = {};
  for (const row of viewRows ?? []) {
    if (row.brand_id) viewCountMap[row.brand_id] = row.view_count ?? 0;
  }
  const likeCountMap: Record<string, number> = {};
  for (const row of likeRows ?? []) {
    if (row.brand_id) likeCountMap[row.brand_id] = (likeCountMap[row.brand_id] ?? 0) + 1;
  }

  const brands = (rows ?? []).map((row) => ({
    ...row,
    view_count: viewCountMap[row.id] ?? 0,
    like_count: likeCountMap[row.id] ?? 0,
  }));

  return NextResponse.json({
    brands,
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

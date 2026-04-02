import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export const GET = async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("ballet_brands")
    .select(
      "id, name_ko, name_en, logo_url, website_url, instagram_url, facebook_url, threads_url, youtube_url, x_url, naver_blog_url, tiktok_url, sort_order"
    )
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("brand detail", error);
    return NextResponse.json({ message: "Failed to load brand" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ brand: data });
};

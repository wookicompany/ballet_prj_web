import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export const GET = async () => {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("ballet_brands")
    .select(
      "id, name_ko, name_en, logo_url, website_url, instagram_url, facebook_url, threads_url, youtube_url, x_url, naver_blog_url, tiktok_url, sort_order"
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("brands list", error);
    return NextResponse.json({ message: "Failed to list brands" }, { status: 500 });
  }

  return NextResponse.json({ brands: data ?? [] });
};

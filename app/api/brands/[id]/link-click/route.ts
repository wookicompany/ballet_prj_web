import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const VALID_LINK_TYPES = [
  "website",
  "instagram",
  "facebook",
  "threads",
  "youtube",
  "x",
  "naver_blog",
  "tiktok",
] as const;

export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: brandId } = await params;

  if (!brandId) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  let linkType: string;
  try {
    const body = await request.json();
    linkType = typeof body.link_type === "string" ? body.link_type.trim() : "";
  } catch {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  if (!VALID_LINK_TYPES.includes(linkType as (typeof VALID_LINK_TYPES)[number])) {
    return NextResponse.json({ message: "Invalid link_type" }, { status: 400 });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("brand_link_clicks")
      .insert({ brand_id: brandId, link_type: linkType });

    if (error) {
      console.error("Failed to track brand link click", error);
      return NextResponse.json(
        { message: "Failed to track link click" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Failed to track brand link click", error);
    return NextResponse.json(
      { message: "Failed to track link click" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};

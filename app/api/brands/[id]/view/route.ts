import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const POST = async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: brandId } = await params;

  if (!brandId) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("brand_views")
      .insert({ brand_id: brandId });

    if (error) {
      console.error("Failed to track brand view", error);
      return NextResponse.json(
        { message: "Failed to track view" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Failed to track brand view", error);
    return NextResponse.json(
      { message: "Failed to track view" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};

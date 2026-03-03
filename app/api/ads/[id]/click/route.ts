import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export const POST = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const supabaseAdmin = getSupabaseAdmin();

  const { data: ad, error: fetchError } = await supabaseAdmin
    .from("ads")
    .select("id, click_count")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("ads click fetch", fetchError);
    return NextResponse.json({ message: "Failed to load ad" }, { status: 500 });
  }
  if (!ad) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("ads")
    .update({
      click_count: (ad.click_count ?? 0) + 1,
      last_clicked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    console.error("ads click update", updateError);
    return NextResponse.json({ message: "Failed to update click" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
};

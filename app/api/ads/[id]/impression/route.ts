import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export const POST = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const supabaseAdmin = getSupabaseAdmin();

  const { error } = await supabaseAdmin.rpc("increment_ad_impression", { ad_id: id });

  if (error) {
    console.error("ad impression track", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
};

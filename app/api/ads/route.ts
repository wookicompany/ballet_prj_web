import { NextResponse } from "next/server";

import { isAdPlacement } from "@/lib/ads";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const placement = searchParams.get("placement") ?? "";
  if (!isAdPlacement(placement)) {
    return NextResponse.json({ message: "invalid placement" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("ads")
    .select("id, placement, provider, title, start_at, end_at")
    .eq("placement", placement)
    .eq("is_active", true)
    .lte("start_at", nowIso)
    .gte("end_at", nowIso)
    .order("start_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("ads get", error);
    return NextResponse.json({ message: "Failed to load ad" }, { status: 500 });
  }

  return NextResponse.json({ ad: data[0] ?? null });
};

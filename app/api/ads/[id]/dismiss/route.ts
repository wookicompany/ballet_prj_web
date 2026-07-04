import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

type Params = {
  params: Promise<{ id: string }>;
};

export const POST = async (request: Request, { params }: Params) => {
  const { user, supabaseAdmin, errorResponse } = await getUserFromRequest(request);
  if (errorResponse || !user || !supabaseAdmin) {
    return errorResponse ?? NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const { data: ad, error: adError } = await supabaseAdmin
    .from("ads")
    .select("id")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (adError) {
    console.error("Failed to validate ad", adError);
    return NextResponse.json({ message: "Failed to dismiss ad" }, { status: 500 });
  }

  if (!ad) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const dismissedAt = new Date().toISOString();
  const { data: dismissal, error: upsertError } = await supabaseAdmin
    .from("ad_dismissals")
    .upsert(
      {
        ad_id: id,
        user_id: user.id,
        dismissed_at: dismissedAt,
        updated_at: dismissedAt,
      },
      { onConflict: "ad_id,user_id" }
    )
    .select("ad_id,dismissed_at")
    .single();

  if (upsertError || !dismissal) {
    console.error("Failed to dismiss ad", upsertError);
    return NextResponse.json({ message: "Failed to dismiss ad" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    ad_id: dismissal.ad_id,
    dismissed_at: dismissal.dismissed_at,
  });
};

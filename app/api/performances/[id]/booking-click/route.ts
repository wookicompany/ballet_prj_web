import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const resolvedParams = await params;
  const fallbackId = (() => {
    try {
      const { pathname } = new URL(request.url);
      const parts = pathname.split("/").filter(Boolean);
      return parts[2] ?? "";
    } catch {
      return "";
    }
  })();
  const performanceId = String(resolvedParams?.id ?? fallbackId ?? "").trim();

  if (!performanceId) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  let relatenm: string | null = null;
  let relateurl: string | null = null;

  try {
    const body = await request.json();
    relatenm = typeof body.relatenm === "string" ? body.relatenm.trim() : null;
    relateurl = typeof body.relateurl === "string" ? body.relateurl.trim() : null;
  } catch {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("performance_booking_clicks")
      .insert({ performance_id: performanceId, relatenm, relateurl });

    if (error) {
      console.error("Failed to track booking click", error);
      return NextResponse.json(
        { message: "Failed to track booking click" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Failed to track booking click", error);
    return NextResponse.json(
      { message: "Failed to track booking click" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};

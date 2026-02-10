import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const POST = async (
  request: Request,
  { params }: { params?: { id?: string } }
) => {
  const fallbackId = (() => {
    try {
      const { pathname } = new URL(request.url);
      const parts = pathname.split("/").filter(Boolean);
      return parts[2] ?? "";
    } catch {
      return "";
    }
  })();
  const performanceId = String(params?.id ?? fallbackId ?? "").trim();

  if (!performanceId) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("performance_views")
      .insert({ performance_id: performanceId });

    if (error) {
      console.error("Failed to track performance view", error);
      return NextResponse.json(
        { message: "Failed to track view" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Failed to track performance view", error);
    return NextResponse.json(
      { message: "Failed to track view" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};

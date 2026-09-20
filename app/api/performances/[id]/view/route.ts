import { NextResponse, type NextRequest } from "next/server";

import { getOptionalUserFromRequest } from "@/lib/apiAuth";
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

  try {
    // 로그인 상태면 누가 봤는지 남긴다. 비로그인 조회도 그대로 집계해야 하므로
    // 토큰이 없거나 검증에 실패하면 user_id만 비우고 진행한다.
    const { user } = await getOptionalUserFromRequest(request);
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("performance_views")
      .insert({ performance_id: performanceId, user_id: user?.id ?? null });

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

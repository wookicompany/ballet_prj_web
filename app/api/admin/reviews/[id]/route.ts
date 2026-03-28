import { NextResponse } from "next/server";

import { getAdminFromRequest } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) {
    return result.errorResponse;
  }

  const { id } = await params;

  const { data: review, error: reviewError } = await result.supabaseAdmin
    .from("performance_reviews")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (reviewError) {
    console.error("Failed to load review", reviewError);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
  if (!review) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const [{ data: performance }, { data: profile }, { data: reports }] = await Promise.all([
    result.supabaseAdmin.from("kopis_performances").select("mt20id, prfnm").eq("mt20id", review.performance_id).maybeSingle(),
    result.supabaseAdmin.from("profiles").select("id, nickname, avatar_url").eq("id", review.user_id).maybeSingle(),
    result.supabaseAdmin.from("performance_review_reports").select("id, reason_code, reason_detail, reporter_user_id, created_at").eq("review_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
  ]);

  const reporterIds = [...new Set((reports ?? []).map((r) => r.reporter_user_id))];
  const reporterProfiles = reporterIds.length > 0
    ? (await result.supabaseAdmin.from("profiles").select("id, nickname").in("id", reporterIds)).data ?? []
    : [];
  const reporterMap: Record<string, string | null> = {};
  for (const p of reporterProfiles) {
    reporterMap[p.id] = p.nickname;
  }

  const reportsWithNickname = (reports ?? []).map((r) => ({
    ...r,
    reporter_nickname: reporterMap[r.reporter_user_id] ?? null,
  }));

  return NextResponse.json({
    review: {
      ...review,
      prfnm: performance?.prfnm ?? review.performance_id,
      nickname: profile?.nickname ?? null,
      avatar_url: profile?.avatar_url ?? null,
    },
    reports: reportsWithNickname,
  });
};

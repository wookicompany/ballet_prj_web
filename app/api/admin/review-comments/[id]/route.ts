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

  const { data: comment, error: commentError } = await result.supabaseAdmin
    .from("performance_review_comments")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (commentError || !comment) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const [reviewRes, profileRes, reportsRes] = await Promise.all([
    result.supabaseAdmin.from("performance_reviews").select("id, performance_id").eq("id", comment.review_id).maybeSingle(),
    result.supabaseAdmin.from("profiles").select("id, nickname, avatar_url").eq("id", comment.user_id).maybeSingle(),
    result.supabaseAdmin.from("performance_review_comment_reports").select("id, reason_code, reason_detail, reporter_user_id, created_at").eq("comment_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
  ]);

  const prfnm = reviewRes.data?.performance_id
    ? (await result.supabaseAdmin.from("kopis_performances").select("prfnm").eq("mt20id", reviewRes.data.performance_id).maybeSingle()).data?.prfnm ?? reviewRes.data.performance_id
    : null;

  const reporterIds = [...new Set((reportsRes.data ?? []).map((r) => r.reporter_user_id))];
  const reporterProfiles = reporterIds.length > 0
    ? (await result.supabaseAdmin.from("profiles").select("id, nickname").in("id", reporterIds)).data ?? []
    : [];
  const reporterMap: Record<string, string | null> = {};
  for (const p of reporterProfiles) {
    reporterMap[p.id] = p.nickname;
  }

  const reportsWithNickname = (reportsRes.data ?? []).map((r) => ({
    ...r,
    reporter_nickname: reporterMap[r.reporter_user_id] ?? null,
  }));

  return NextResponse.json({
    comment: {
      ...comment,
      prfnm,
      nickname: profileRes.data?.nickname ?? null,
      avatar_url: profileRes.data?.avatar_url ?? null,
    },
    reports: reportsWithNickname,
  });
};

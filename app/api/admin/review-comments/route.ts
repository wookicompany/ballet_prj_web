import { NextResponse } from "next/server";

import { getAdminFromRequest } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const GET = async (request: Request) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) {
    return result.errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Number(searchParams.get("offset")) || 0;

  const { data: rows, error } = await result.supabaseAdmin
    .from("performance_review_comments")
    .select("id, review_id, user_id, content, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("admin review-comments list", error);
    return NextResponse.json({ message: "Failed to list comments" }, { status: 500 });
  }

  const reviewIds = [...new Set((rows ?? []).map((r) => r.review_id))];
  const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];

  const [reviewsData, profilesData, reportsData] = await Promise.all([
    reviewIds.length > 0
      ? result.supabaseAdmin.from("performance_reviews").select("id, performance_id").in("id", reviewIds)
      : { data: [] as { id: string; performance_id: string }[] },
    userIds.length > 0
      ? result.supabaseAdmin.from("profiles").select("id, nickname").in("id", userIds)
      : { data: [] as { id: string; nickname: string | null }[] },
    result.supabaseAdmin.from("performance_review_comment_reports").select("comment_id"),
  ]);

  const perfIds = [...new Set((reviewsData.data ?? []).map((r) => r.performance_id))];
  const perfData = perfIds.length > 0
    ? (await result.supabaseAdmin.from("kopis_performances").select("mt20id, prfnm").in("mt20id", perfIds)).data ?? []
    : [];
  const prfnmMap: Record<string, string> = {};
  for (const p of perfData) {
    prfnmMap[p.mt20id] = p.prfnm ?? p.mt20id;
  }
  const reviewToPerf: Record<string, string> = {};
  for (const r of reviewsData.data ?? []) {
    reviewToPerf[r.id] = prfnmMap[r.performance_id] ?? r.performance_id;
  }
  const nicknameMap: Record<string, string | null> = {};
  for (const p of profilesData.data ?? []) {
    nicknameMap[p.id] = p.nickname;
  }
  const reportCountMap: Record<string, number> = {};
  for (const r of reportsData.data ?? []) {
    reportCountMap[r.comment_id] = (reportCountMap[r.comment_id] ?? 0) + 1;
  }

  const comments = (rows ?? []).map((r) => ({
    ...r,
    prfnm: reviewToPerf[r.review_id] ?? null,
    nickname: nicknameMap[r.user_id] ?? null,
    report_count: reportCountMap[r.id] ?? 0,
  }));

  const { count } = await result.supabaseAdmin
    .from("performance_review_comments")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);

  return NextResponse.json({
    comments,
    total: count ?? 0,
    limit,
    offset,
  });
};

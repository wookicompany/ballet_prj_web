import { NextResponse } from "next/server";

import { getAdminFromRequest } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export const GET = async (request: Request) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) {
    return result.errorResponse;
  }

  const { supabaseAdmin } = result;

  const [
    { count: totalUsers },
    { count: totalRecords },
    { data: recordUserIds },
    { count: totalReviews },
    { count: totalComments },
    { data: reviewUserIds },
  ] = await Promise.all([
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabaseAdmin.from("records").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabaseAdmin.from("records").select("user_id").is("deleted_at", null),
    supabaseAdmin.from("performance_reviews").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabaseAdmin.from("performance_review_comments").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabaseAdmin
      .from("performance_reviews")
      .select("user_id")
      .is("deleted_at", null),
  ]);

  const commentUserIds =
    (await supabaseAdmin.from("performance_review_comments").select("user_id").is("deleted_at", null)).data ?? [];

  const calendarUserIds = new Set((recordUserIds ?? []).map((r) => r.user_id));
  const reviewCommentUserIds = new Set([
    ...(reviewUserIds ?? []).map((r) => r.user_id),
    ...commentUserIds.map((c) => c.user_id),
  ]);

  return NextResponse.json({
    total_users: totalUsers ?? 0,
    total_records: totalRecords ?? 0,
    calendar_users: calendarUserIds.size,
    total_reviews: totalReviews ?? 0,
    total_comments: totalComments ?? 0,
    performance_users: reviewCommentUserIds.size,
  });
};

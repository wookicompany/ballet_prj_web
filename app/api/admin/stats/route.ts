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
    { data: totalUsers },
    { count: totalRecords },
    { count: totalReviews },
    { count: totalComments },
    { count: totalBrandLikes },
    { data: calendarUsersData },
    { data: performanceUsersData },
    { data: brandUsersData },
  ] = await Promise.all([
    supabaseAdmin.rpc("get_total_auth_users_count"),
    supabaseAdmin.from("records").select("id", { count: "exact", head: true }).eq("status", "done").is("deleted_at", null),
    supabaseAdmin.from("performance_reviews").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabaseAdmin.from("performance_review_comments").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabaseAdmin.from("brand_likes").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabaseAdmin.rpc("get_calendar_users_count"),
    supabaseAdmin.rpc("get_performance_users_count"),
    supabaseAdmin.rpc("get_brand_users_count"),
  ]);

  return NextResponse.json({
    total_users: Number(totalUsers ?? 0),
    total_records: totalRecords ?? 0,
    calendar_users: Number(calendarUsersData ?? 0),
    total_reviews: totalReviews ?? 0,
    total_comments: totalComments ?? 0,
    performance_users: Number(performanceUsersData ?? 0),
    total_brand_likes: totalBrandLikes ?? 0,
    brand_users: Number(brandUsersData ?? 0),
  });
};

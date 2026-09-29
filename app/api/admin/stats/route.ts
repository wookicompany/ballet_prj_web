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
    { count: totalTickets },
    { data: calendarUsersData },
    { data: performanceUsersData },
    { data: brandUsersData },
    { count: completedLessons },
    { count: plannedLessons },
    { data: activeUserStats },
  ] = await Promise.all([
    supabaseAdmin.rpc("get_total_auth_users_count"),
    supabaseAdmin.from("records").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabaseAdmin.from("performance_reviews").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabaseAdmin.from("performance_review_comments").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabaseAdmin.from("brand_likes").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabaseAdmin.from("performance_tickets").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabaseAdmin.rpc("get_calendar_users_count"),
    supabaseAdmin.rpc("get_performance_users_count"),
    supabaseAdmin.rpc("get_brand_users_count"),
    supabaseAdmin.from("records").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "done"),
    supabaseAdmin.from("records").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "planned"),
    // 공연 조회, 예매 클릭, 브랜드 링크 클릭 누적치는 대시보드 카드에서 뺐다.
    // 추세는 performance-trend와 brand-trend 차트가 별도로 집계한다.
    supabaseAdmin.rpc("get_active_user_stats"),
  ]);

  // RPC가 한 행짜리 테이블을 돌려주므로 첫 행을 꺼낸다.
  const activity = Array.isArray(activeUserStats) ? activeUserStats[0] : null;

  return NextResponse.json({
    total_users: Number(totalUsers ?? 0),
    total_records: totalRecords ?? 0,
    calendar_users: Number(calendarUsersData ?? 0),
    total_reviews: totalReviews ?? 0,
    total_comments: totalComments ?? 0,
    total_tickets: totalTickets ?? 0,
    performance_users: Number(performanceUsersData ?? 0),
    total_brand_likes: totalBrandLikes ?? 0,
    brand_users: Number(brandUsersData ?? 0),
    dau: Number(activity?.dau ?? 0),
    wau: Number(activity?.wau ?? 0),
    mau: Number(activity?.mau ?? 0),
    completed_lessons: completedLessons ?? 0,
    planned_lessons: plannedLessons ?? 0,
  });
};

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
    { count: profileMembers },
    { count: completedLessons },
    { count: plannedLessons },
    { count: totalPerformanceViews },
    { count: totalBookingClicks },
    { count: totalBrandLinkClicks },
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
    // profiles 행은 가입 시점이 아니라 프로필 탭 최초 진입 때 만들어진다. 그래서
    // auth.users(44)보다 적다(40) — 탈퇴자가 아니라 프로필을 아직 안 만든 사람들이다.
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabaseAdmin.from("records").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "done"),
    supabaseAdmin.from("records").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "planned"),
    // 조회와 클릭은 익명 행이 섞여 있어 건수로만 센다.
    supabaseAdmin.from("performance_views").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("performance_booking_clicks").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("brand_link_clicks").select("id", { count: "exact", head: true }),
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
    profile_members: profileMembers ?? 0,
    dau: Number(activity?.dau ?? 0),
    wau: Number(activity?.wau ?? 0),
    mau: Number(activity?.mau ?? 0),
    completed_lessons: completedLessons ?? 0,
    planned_lessons: plannedLessons ?? 0,
    total_performance_views: totalPerformanceViews ?? 0,
    total_booking_clicks: totalBookingClicks ?? 0,
    total_brand_link_clicks: totalBrandLinkClicks ?? 0,
  });
};

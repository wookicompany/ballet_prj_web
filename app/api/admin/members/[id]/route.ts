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

  // auth.users 기준으로 존재 여부 판단 — profiles 없는 계정(탈퇴·프로필 미생성)도 조회 가능
  const { data: authUserData, error: authUserError } = await result.supabaseAdmin.auth.admin.getUserById(id);
  if (authUserError || !authUserData?.user) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  const authUser = authUserData.user;

  const [
    { data: profile, error: profileError },
    { count: recordsCount },
    { count: reviewsCount },
    { count: commentsCount },
    { count: likeBrandsCount },
    { data: recentRecords },
    { data: recentReviews },
    { data: recentComments },
    { data: recentLikedBrands },
  ] = await Promise.all([
    result.supabaseAdmin.from("profiles").select("*").eq("id", id).maybeSingle(),
    result.supabaseAdmin.from("records").select("id", { count: "exact", head: true }).eq("user_id", id).is("deleted_at", null),
    result.supabaseAdmin.from("performance_reviews").select("id", { count: "exact", head: true }).eq("user_id", id).is("deleted_at", null),
    result.supabaseAdmin.from("performance_review_comments").select("id", { count: "exact", head: true }).eq("user_id", id).is("deleted_at", null),
    result.supabaseAdmin.from("brand_likes").select("id", { count: "exact", head: true }).eq("user_id", id).is("deleted_at", null),
    result.supabaseAdmin.from("records").select("id, record_date, content, created_at").eq("user_id", id).is("deleted_at", null).order("created_at", { ascending: false }).limit(12),
    result.supabaseAdmin.from("performance_reviews").select("id, content, created_at").eq("user_id", id).is("deleted_at", null).order("created_at", { ascending: false }).limit(12),
    result.supabaseAdmin.from("performance_review_comments").select("id, content, created_at").eq("user_id", id).is("deleted_at", null).order("created_at", { ascending: false }).limit(12),
    result.supabaseAdmin.from("brand_likes").select("id, brand_id, created_at, ballet_brands(id, name_ko)").eq("user_id", id).is("deleted_at", null).order("created_at", { ascending: false }).limit(12),
  ]);

  if (profileError) {
    console.error("Failed to load profile", profileError);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    id: authUser.id,
    email: authUser.email ?? null,
    auth_created_at: authUser.created_at,
    profile,
    record_count: recordsCount ?? 0,
    review_count: reviewsCount ?? 0,
    comment_count: commentsCount ?? 0,
    like_brand_count: likeBrandsCount ?? 0,
    recent_records: recentRecords ?? [],
    recent_reviews: recentReviews ?? [],
    recent_comments: recentComments ?? [],
    recent_liked_brands: recentLikedBrands ?? [],
  });
};

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

  const { data: profile, error: profileError } = await result.supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to load profile", profileError);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const [
    { count: recordsCount },
    { count: reviewsCount },
    { count: commentsCount },
    { data: authUser },
    { data: recentRecords },
    { data: recentReviews },
    { data: recentComments },
  ] = await Promise.all([
    result.supabaseAdmin.from("records").select("id", { count: "exact", head: true }).eq("user_id", id).is("deleted_at", null),
    result.supabaseAdmin.from("performance_reviews").select("id", { count: "exact", head: true }).eq("user_id", id).is("deleted_at", null),
    result.supabaseAdmin.from("performance_review_comments").select("id", { count: "exact", head: true }).eq("user_id", id).is("deleted_at", null),
    result.supabaseAdmin.auth.admin.getUserById(id),
    result.supabaseAdmin.from("records").select("id, record_date, content, created_at").eq("user_id", id).is("deleted_at", null).order("created_at", { ascending: false }).limit(12),
    result.supabaseAdmin.from("performance_reviews").select("id, content, created_at").eq("user_id", id).is("deleted_at", null).order("created_at", { ascending: false }).limit(12),
    result.supabaseAdmin.from("performance_review_comments").select("id, content, created_at").eq("user_id", id).is("deleted_at", null).order("created_at", { ascending: false }).limit(12),
  ]);

  return NextResponse.json({
    profile,
    email: authUser?.user?.email ?? null,
    record_count: recordsCount ?? 0,
    review_count: reviewsCount ?? 0,
    comment_count: commentsCount ?? 0,
    recent_records: recentRecords ?? [],
    recent_reviews: recentReviews ?? [],
    recent_comments: recentComments ?? [],
  });
};

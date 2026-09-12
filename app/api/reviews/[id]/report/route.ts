import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";
import {
  REPORT_THRESHOLD,
  isReportReasonCode,
  type ReportReasonCode,
} from "@/lib/reports";

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const auth = await getUserFromRequest(request);

  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  const { data: review, error: reviewError } = await auth.supabaseAdmin
    .from("performance_reviews")
    .select("id, user_id, deleted_at, is_public")
    .eq("id", id)
    .maybeSingle();

  if (reviewError) {
    console.error("Failed to load review", reviewError);
    return NextResponse.json({ message: "Failed to load review" }, { status: 500 });
  }

  // 비공개 리뷰는 본인 외에는 존재 자체를 숨긴다(404) — 아래 소유자 403보다 먼저 판정해야
  // 타인이 "신고했더니 403이 아니라 404"로 공개 여부를 역추론하는 것도 막힌다.
  if (!review || review.deleted_at) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (!review.is_public && review.user_id !== auth.user.id) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (review.user_id === auth.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const reasonCode = typeof body?.reason_code === "string" ? body.reason_code : "";
  const reasonDetail =
    typeof body?.reason_detail === "string" && body.reason_detail.trim()
      ? body.reason_detail.trim()
      : null;

  if (!isReportReasonCode(reasonCode)) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  const { error: upsertError } = await auth.supabaseAdmin
    .from("performance_review_reports")
    .upsert(
      {
        review_id: id,
        reporter_user_id: auth.user.id,
        reason_code: reasonCode as ReportReasonCode,
        reason_detail: reasonDetail,
      },
      { onConflict: "review_id,reporter_user_id" }
    );

  if (upsertError) {
    console.error("Failed to report review", upsertError);
    return NextResponse.json({ message: "Failed to report review" }, { status: 500 });
  }

  const { count, error: countError } = await auth.supabaseAdmin
    .from("performance_review_reports")
    .select("id", { count: "exact", head: true })
    .eq("review_id", id)
    .is("deleted_at", null);

  if (countError) {
    console.error("Failed to count review reports", countError);
    return NextResponse.json(
      { message: "Failed to count review reports" },
      { status: 500 }
    );
  }

  const reportCount = count ?? 0;

  return NextResponse.json({
    ok: true,
    report_count: reportCount,
    is_hidden: reportCount >= REPORT_THRESHOLD,
  });
};

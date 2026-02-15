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

  const { data: comment, error: commentError } = await auth.supabaseAdmin
    .from("performance_review_comments")
    .select("id, user_id, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (commentError) {
    console.error("Failed to load comment", commentError);
    return NextResponse.json(
      { message: "Failed to load comment" },
      { status: 500 }
    );
  }

  if (!comment || comment.deleted_at) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (comment.user_id === auth.user.id) {
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
    .from("performance_review_comment_reports")
    .upsert(
      {
        comment_id: id,
        reporter_user_id: auth.user.id,
        reason_code: reasonCode as ReportReasonCode,
        reason_detail: reasonDetail,
      },
      { onConflict: "comment_id,reporter_user_id" }
    );

  if (upsertError) {
    console.error("Failed to report comment", upsertError);
    return NextResponse.json(
      { message: "Failed to report comment" },
      { status: 500 }
    );
  }

  const { count, error: countError } = await auth.supabaseAdmin
    .from("performance_review_comment_reports")
    .select("id", { count: "exact", head: true })
    .eq("comment_id", id)
    .is("deleted_at", null);

  if (countError) {
    console.error("Failed to count comment reports", countError);
    return NextResponse.json(
      { message: "Failed to count comment reports" },
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

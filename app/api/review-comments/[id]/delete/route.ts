import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

export const DELETE = async (
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

  if (comment.user_id !== auth.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { error: updateError } = await auth.supabaseAdmin
    .from("performance_review_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);

  if (updateError) {
    console.error("Failed to delete comment", updateError);
    return NextResponse.json(
      { message: "Failed to delete comment" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};

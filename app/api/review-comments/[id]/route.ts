import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

export const PATCH = async (
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

  const body = await request.json();
  const content =
    typeof body?.content === "string" && body.content.trim()
      ? body.content.trim()
      : "";

  if (!content) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  const { error: updateError } = await auth.supabaseAdmin
    .from("performance_review_comments")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);

  if (updateError) {
    console.error("Failed to update comment", updateError);
    return NextResponse.json(
      { message: "Failed to update comment" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};

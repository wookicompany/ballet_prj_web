import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } =
    await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    if (userError) {
      console.error("Failed to validate user token", userError);
    }
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data: comment, error: commentError } = await supabaseAdmin
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

  if (comment.user_id !== userData.user.id) {
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

  const { error: updateError } = await supabaseAdmin
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

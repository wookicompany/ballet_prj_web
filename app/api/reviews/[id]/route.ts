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

  const { data: review, error: reviewError } = await auth.supabaseAdmin
    .from("performance_reviews")
    .select("id, user_id, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (reviewError) {
    console.error("Failed to load review", reviewError);
    return NextResponse.json(
      { message: "Failed to load review" },
      { status: 500 }
    );
  }

  if (!review || review.deleted_at) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (review.user_id !== auth.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const rating = Number(body?.rating ?? 0);
  const content =
    typeof body?.content === "string" && body.content.trim()
      ? body.content.trim()
      : null;

  if (
    !Number.isFinite(rating) ||
    !Number.isInteger(rating) ||
    rating < 2 ||
    rating > 10 ||
    rating % 2 !== 0
  ) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  const { error: updateError } = await auth.supabaseAdmin
    .from("performance_reviews")
    .update({ rating, content })
    .eq("id", id)
    .is("deleted_at", null);

  if (updateError) {
    console.error("Failed to update review", updateError);
    return NextResponse.json(
      { message: "Failed to update review" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};

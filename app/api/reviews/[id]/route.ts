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

  const { data: review, error: reviewError } = await supabaseAdmin
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

  if (review.user_id !== userData.user.id) {
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

  const { error: updateError } = await supabaseAdmin
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

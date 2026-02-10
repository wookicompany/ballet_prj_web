import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const DELETE = async (
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
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (reviewError) {
    console.error("Failed to load review", reviewError);
    return NextResponse.json(
      { message: "Failed to load review" },
      { status: 500 }
    );
  }

  if (!review) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (review.user_id !== userData.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("performance_reviews")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    console.error("Failed to delete review", updateError);
    return NextResponse.json(
      { message: "Failed to delete review" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};

import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const POST = async (request: Request) => {
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

  const body = await request.json();
  const performanceId = String(body?.performance_id ?? "");
  const rating = Number(body?.rating ?? 0);
  const content =
    typeof body?.content === "string" && body.content.trim()
      ? body.content.trim()
      : null;

  if (
    !performanceId ||
    !Number.isFinite(rating) ||
    !Number.isInteger(rating) ||
    rating < 2 ||
    rating > 10 ||
    rating % 2 !== 0
  ) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("performance_reviews")
    .insert({
      performance_id: performanceId,
      user_id: userData.user.id,
      rating,
      content,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to create review", error);
    return NextResponse.json(
      { message: "Failed to create review" },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: data.id });
};

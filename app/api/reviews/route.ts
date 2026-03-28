import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

export const POST = async (request: Request) => {
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
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

  const { data, error } = await auth.supabaseAdmin
    .from("performance_reviews")
    .insert({
      performance_id: performanceId,
      user_id: auth.user.id,
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

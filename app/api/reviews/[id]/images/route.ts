import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const POST = async (
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
  const urls = Array.isArray(body?.urls) ? body.urls : [];
  const cleanedUrls = urls
    .filter((url) => typeof url === "string" && url.trim())
    .map((url) => url.trim());

  if (cleanedUrls.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error: insertError } = await supabaseAdmin
    .from("performance_review_images")
    .insert(
      cleanedUrls.map((url) => ({
        review_id: id,
        user_id: userData.user.id,
        url,
      }))
    );

  if (insertError) {
    console.error("Failed to create review images", insertError);
    return NextResponse.json(
      { message: "Failed to create images" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};

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
  const imageIds = Array.isArray(body?.imageIds) ? body.imageIds : [];
  const cleanedIds = imageIds.filter((value) => typeof value === "string");

  if (cleanedIds.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { data: rows, error: rowsError } = await supabaseAdmin
    .from("performance_review_images")
    .select("id, user_id, review_id")
    .in("id", cleanedIds);

  if (rowsError) {
    console.error("Failed to load review images", rowsError);
    return NextResponse.json(
      { message: "Failed to load images" },
      { status: 500 }
    );
  }

  const unauthorized = (rows ?? []).some(
    (row) => row.user_id !== userData.user.id || row.review_id !== id
  );
  if (unauthorized || (rows ?? []).length !== cleanedIds.length) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("performance_review_images")
    .delete()
    .in("id", cleanedIds);

  if (deleteError) {
    console.error("Failed to delete review images", deleteError);
    return NextResponse.json(
      { message: "Failed to delete images" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};

import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

export const POST = async (
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
  const urls = Array.isArray(body?.urls) ? body.urls : [];
  const cleanedUrls = urls
    .filter((url: unknown): url is string => {
      return typeof url === "string" && url.trim().length > 0;
    })
    .map((url: string) => url.trim());

  if (cleanedUrls.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error: insertError } = await auth.supabaseAdmin
    .from("performance_review_images")
    .insert(
      cleanedUrls.map((url: string) => ({
        review_id: id,
        user_id: auth.user.id,
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
  const imageIds = Array.isArray(body?.imageIds) ? body.imageIds : [];
  const cleanedIds = imageIds.filter(
    (value: unknown): value is string => typeof value === "string"
  );

  if (cleanedIds.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { data: rows, error: rowsError } = await auth.supabaseAdmin
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
    (row) => row.user_id !== auth.user.id || row.review_id !== id
  );
  if (unauthorized || (rows ?? []).length !== cleanedIds.length) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { error: deleteError } = await auth.supabaseAdmin
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

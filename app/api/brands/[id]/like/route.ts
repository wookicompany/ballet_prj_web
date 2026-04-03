import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  const { id: brandId } = await params;

  if (!brandId) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  const { data: brand, error: brandError } = await auth.supabaseAdmin
    .from("ballet_brands")
    .select("id")
    .eq("id", brandId)
    .eq("is_active", true)
    .maybeSingle();

  if (brandError) {
    console.error("Failed to load brand", brandError);
    return NextResponse.json({ message: "Failed to load brand" }, { status: 500 });
  }

  if (!brand) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const { data: existing, error: fetchError } = await auth.supabaseAdmin
    .from("brand_likes")
    .select("id, deleted_at")
    .eq("user_id", auth.user.id)
    .eq("brand_id", brandId)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to fetch brand like", fetchError);
    return NextResponse.json({ message: "Failed to fetch like" }, { status: 500 });
  }

  if (!existing) {
    const { error: insertError } = await auth.supabaseAdmin
      .from("brand_likes")
      .insert({ user_id: auth.user.id, brand_id: brandId });

    if (insertError) {
      console.error("Failed to insert brand like", insertError);
      return NextResponse.json({ message: "Failed to add like" }, { status: 500 });
    }

    return NextResponse.json({ liked: true });
  }

  if (existing.deleted_at === null) {
    const { error: deleteError } = await auth.supabaseAdmin
      .from("brand_likes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", existing.id);

    if (deleteError) {
      console.error("Failed to remove brand like", deleteError);
      return NextResponse.json({ message: "Failed to remove like" }, { status: 500 });
    }

    return NextResponse.json({ liked: false });
  }

  const { error: restoreError } = await auth.supabaseAdmin
    .from("brand_likes")
    .update({ deleted_at: null })
    .eq("id", existing.id);

  if (restoreError) {
    console.error("Failed to restore brand like", restoreError);
    return NextResponse.json({ message: "Failed to restore like" }, { status: 500 });
  }

  return NextResponse.json({ liked: true });
};

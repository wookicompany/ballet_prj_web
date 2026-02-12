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

  const existing = await auth.supabaseAdmin
    .from("saved_center_orders")
    .select("id, user_id")
    .eq("id", id)
    .single();

  if (existing.error || !existing.data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (existing.data.user_id !== auth.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const orderText =
    typeof body?.order_text === "string" ? body.order_text.trim() : "";

  if (!id || !name) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  const { data, error } = await auth.supabaseAdmin
    .from("saved_center_orders")
    .update({ name, order_text: orderText })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id, name, order_text, created_at")
    .single();

  if (error || !data) {
    console.error("Failed to update saved center order", error);
    return NextResponse.json(
      { message: "Failed to update saved center order" },
      { status: 500 }
    );
  }

  return NextResponse.json({ item: data });
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

  const existing = await auth.supabaseAdmin
    .from("saved_center_orders")
    .select("id, user_id")
    .eq("id", id)
    .single();

  if (existing.error || !existing.data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (existing.data.user_id !== auth.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { error } = await auth.supabaseAdmin
    .from("saved_center_orders")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) {
    console.error("Failed to delete saved center order", error);
    return NextResponse.json(
      { message: "Failed to delete saved center order" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};

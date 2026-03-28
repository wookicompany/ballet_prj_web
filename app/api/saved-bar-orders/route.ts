import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

export const GET = async (request: Request) => {
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  const { data, error } = await auth.supabaseAdmin
    .from("saved_bar_orders")
    .select("id, name, order_text, created_at")
    .eq("user_id", auth.user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load saved bar orders", error);
    return NextResponse.json(
      { message: "Failed to load saved bar orders" },
      { status: 500 }
    );
  }

  return NextResponse.json({ items: data ?? [] });
};

export const POST = async (request: Request) => {
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  const body = await request.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const orderText =
    typeof body?.order_text === "string" ? body.order_text.trim() : "";

  if (!name) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  const { data, error } = await auth.supabaseAdmin
    .from("saved_bar_orders")
    .insert({
      user_id: auth.user.id,
      name,
      order_text: orderText,
    })
    .select("id, name, order_text, created_at")
    .single();

  if (error || !data) {
    console.error("Failed to create saved bar order", error);
    return NextResponse.json(
      { message: "Failed to create saved bar order" },
      { status: 500 }
    );
  }

  return NextResponse.json({ item: data });
};

import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

export const GET = async (request: Request) => {
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  const { data, error } = await auth.supabaseAdmin
    .from("saved_locations")
    .select("id, name, address_base, address_detail, created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load saved locations", error);
    return NextResponse.json(
      { message: "Failed to load saved locations" },
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
  const addressBase =
    typeof body?.address_base === "string" ? body.address_base.trim() : "";
  const addressDetail =
    typeof body?.address_detail === "string" ? body.address_detail.trim() : "";

  if (!name) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  const { data, error } = await auth.supabaseAdmin
    .from("saved_locations")
    .insert({
      user_id: auth.user.id,
      name,
      address_base: addressBase || null,
      address_detail: addressDetail || null,
    })
    .select("id, name, address_base, address_detail, created_at")
    .single();

  if (error || !data) {
    console.error("Failed to create saved location", error);
    return NextResponse.json(
      { message: "Failed to create saved location" },
      { status: 500 }
    );
  }

  return NextResponse.json({ item: data });
};

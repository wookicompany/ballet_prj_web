import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  const { data, error } = await auth.supabaseAdmin
    .from("saved_locations")
    .select("id, name, address_base, address_detail, created_at")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("Failed to load saved location", error);
    return NextResponse.json({ message: "Failed to load saved location" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ item: data });
};

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
    .from("saved_locations")
    .select("id, user_id, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (existing.error) {
    console.error("Failed to load saved location", existing.error);
    return NextResponse.json({ message: "Failed to load saved location" }, { status: 500 });
  }
  if (!existing.data || existing.data.deleted_at) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (existing.data.user_id !== auth.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const addressBase =
    typeof body?.address_base === "string" ? body.address_base.trim() : "";
  const addressDetail =
    typeof body?.address_detail === "string" ? body.address_detail.trim() : "";

  if (!id || !name) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  const { data, error } = await auth.supabaseAdmin
    .from("saved_locations")
    .update({
      name,
      address_base: addressBase || null,
      address_detail: addressDetail || null,
    })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .is("deleted_at", null)
    .select("id, name, address_base, address_detail, created_at")
    .single();

  if (error || !data) {
    console.error("Failed to update saved location", error);
    return NextResponse.json(
      { message: "Failed to update saved location" },
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
    .from("saved_locations")
    .select("id, user_id, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (existing.error) {
    console.error("Failed to load saved location", existing.error);
    return NextResponse.json({ message: "Failed to load saved location" }, { status: 500 });
  }
  if (!existing.data || existing.data.deleted_at) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (existing.data.user_id !== auth.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { error } = await auth.supabaseAdmin
    .from("saved_locations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) {
    console.error("Failed to delete saved location", error);
    return NextResponse.json(
      { message: "Failed to delete saved location" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};

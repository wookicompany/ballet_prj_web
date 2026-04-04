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
    .from("saved_instructor_levels")
    .select("id, instructor, level, created_at")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("Failed to load saved instructor level", error);
    return NextResponse.json({ message: "Failed to load saved instructor level" }, { status: 500 });
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
    .from("saved_instructor_levels")
    .select("id, user_id, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (existing.error) {
    console.error("Failed to load saved instructor level", existing.error);
    return NextResponse.json({ message: "Failed to load saved instructor level" }, { status: 500 });
  }
  if (!existing.data || existing.data.deleted_at) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (existing.data.user_id !== auth.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const instructor =
    typeof body?.instructor === "string" ? body.instructor.trim() : "";
  const level = typeof body?.level === "string" ? body.level.trim() : "";

  if (!id || !instructor || !level) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  const { data, error } = await auth.supabaseAdmin
    .from("saved_instructor_levels")
    .update({ instructor, level })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .is("deleted_at", null)
    .select("id, instructor, level, created_at")
    .single();

  if (error || !data) {
    console.error("Failed to update saved instructor level", error);
    return NextResponse.json(
      { message: "Failed to update saved instructor level" },
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
    .from("saved_instructor_levels")
    .select("id, user_id, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (existing.error) {
    console.error("Failed to load saved instructor level", existing.error);
    return NextResponse.json({ message: "Failed to load saved instructor level" }, { status: 500 });
  }
  if (!existing.data || existing.data.deleted_at) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (existing.data.user_id !== auth.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { error } = await auth.supabaseAdmin
    .from("saved_instructor_levels")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) {
    console.error("Failed to delete saved instructor level", error);
    return NextResponse.json(
      { message: "Failed to delete saved instructor level" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};

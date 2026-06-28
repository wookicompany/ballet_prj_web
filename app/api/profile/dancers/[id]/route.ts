import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse ?? NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const existing = await auth.supabaseAdmin
    .from("favorite_dancers")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (existing.error) {
    console.error("Failed to load favorite dancer", existing.error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
  if (!existing.data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (existing.data.user_id !== auth.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  let body: { name?: unknown };
  try {
    body = (await request.json()) as { name?: unknown };
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const raw = typeof body.name === "string" ? body.name.trim() : "";
  if (!raw) {
    return NextResponse.json({ message: "무용수 이름을 입력해 주세요." }, { status: 400 });
  }
  if (raw.length > 20) {
    return NextResponse.json({ message: "무용수 이름은 최대 20자까지 가능합니다." }, { status: 400 });
  }

  const { data, error } = await auth.supabaseAdmin
    .from("favorite_dancers")
    .update({ name: raw })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id, name, created_at")
    .single();

  if (error || !data) {
    console.error("Failed to update favorite dancer", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
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
    return auth.errorResponse ?? NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const existing = await auth.supabaseAdmin
    .from("favorite_dancers")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (existing.error) {
    console.error("Failed to load favorite dancer", existing.error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
  if (!existing.data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (existing.data.user_id !== auth.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { error } = await auth.supabaseAdmin
    .from("favorite_dancers")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) {
    console.error("Failed to delete favorite dancer", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
};

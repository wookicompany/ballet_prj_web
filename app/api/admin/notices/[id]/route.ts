import { NextResponse } from "next/server";

import { getAdminFromRequest } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) {
    return result.errorResponse;
  }

  const { id } = await params;

  const { data: notice, error } = await result.supabaseAdmin
    .from("notices")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("admin notice get", error);
    return NextResponse.json({ message: "Failed to load notice" }, { status: 500 });
  }

  if (!notice) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ notice });
};

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) {
    return result.errorResponse;
  }

  const { id } = await params;

  const { data: existing, error: fetchError } = await result.supabaseAdmin
    .from("notices")
    .select("id, is_published, published_at")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  let body: { title?: string; content?: string; is_published?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const updates: { title?: string; content?: string; is_published?: boolean; published_at?: string | null; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (t) updates.title = t;
  }
  if (typeof body.content === "string") {
    updates.content = body.content.trim();
  }
  if (typeof body.is_published === "boolean") {
    updates.is_published = body.is_published;
    if (body.is_published && !existing.is_published && !existing.published_at) {
      updates.published_at = new Date().toISOString();
    }
  }

  const { data: notice, error: updateError } = await result.supabaseAdmin
    .from("notices")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    console.error("admin notice patch", updateError);
    return NextResponse.json({ message: "Failed to update notice" }, { status: 500 });
  }

  return NextResponse.json({ notice });
};

export const DELETE = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) {
    return result.errorResponse;
  }

  const { id } = await params;

  const { error } = await result.supabaseAdmin
    .from("notices")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("admin notice delete", error);
    return NextResponse.json({ message: "Failed to delete notice" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
};

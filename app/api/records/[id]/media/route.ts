import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

type MediaItem = {
  url: string;
  media_type: "image" | "video";
};

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  const { data: record, error: recordError } = await auth.supabaseAdmin
    .from("records")
    .select("id, user_id, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (recordError) {
    console.error("Failed to load record", recordError);
    return NextResponse.json(
      { message: "Failed to load record" },
      { status: 500 }
    );
  }

  if (!record || record.deleted_at) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (record.user_id !== auth.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const items = Array.isArray(body?.items) ? body.items : [];
  const cleanedItems = items.filter(
    (item: MediaItem) =>
      item &&
      typeof item.url === "string" &&
      item.url.trim() &&
      (item.media_type === "image" || item.media_type === "video")
  );

  if (cleanedItems.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error: insertError } = await auth.supabaseAdmin
    .from("record_media")
    .insert(
      cleanedItems.map((item: MediaItem) => ({
        record_id: id,
        user_id: auth.user.id,
        url: item.url.trim(),
        media_type: item.media_type,
      }))
    );

  if (insertError) {
    console.error("Failed to create record media", insertError);
    return NextResponse.json(
      { message: "Failed to create record media" },
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

  const { data: record, error: recordError } = await auth.supabaseAdmin
    .from("records")
    .select("id, user_id, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (recordError) {
    console.error("Failed to load record", recordError);
    return NextResponse.json(
      { message: "Failed to load record" },
      { status: 500 }
    );
  }

  if (!record || record.deleted_at) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (record.user_id !== auth.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const mediaIds = Array.isArray(body?.mediaIds) ? body.mediaIds : [];
  const cleanedIds = mediaIds.filter(
    (value: unknown): value is string => typeof value === "string"
  );

  if (cleanedIds.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { data: rows, error: rowsError } = await auth.supabaseAdmin
    .from("record_media")
    .select("id, user_id, record_id, url")
    .in("id", cleanedIds);

  if (rowsError) {
    console.error("Failed to load record media", rowsError);
    return NextResponse.json(
      { message: "Failed to load record media" },
      { status: 500 }
    );
  }

  const unauthorized = (rows ?? []).some(
    (row) => row.user_id !== auth.user.id || row.record_id !== id
  );
  if (unauthorized || (rows ?? []).length !== cleanedIds.length) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { error: deleteError } = await auth.supabaseAdmin
    .from("record_media")
    .delete()
    .in("id", cleanedIds);

  if (deleteError) {
    console.error("Failed to delete record media", deleteError);
    return NextResponse.json(
      { message: "Failed to delete record media" },
      { status: 500 }
    );
  }

  const storagePaths = (rows ?? [])
    .map((row) =>
      row.url.split("/storage/v1/object/public/record-media/")[1]
    )
    .filter(Boolean);

  if (storagePaths.length > 0) {
    const { error: storageError } = await auth.supabaseAdmin.storage
      .from("record-media")
      .remove(storagePaths);
    if (storageError) {
      console.error("Failed to delete storage objects", storageError);
    }
  }

  return NextResponse.json({ ok: true });
};

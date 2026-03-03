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

  const { data: recordRow, error: recordError } = await result.supabaseAdmin
    .from("records")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (recordError) {
    console.error("admin record get", recordError);
    return NextResponse.json({ message: "Failed to load record" }, { status: 500 });
  }

  if (!recordRow) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const { data: profile } = await result.supabaseAdmin
    .from("profiles")
    .select("nickname, avatar_url")
    .eq("id", recordRow.user_id)
    .maybeSingle();

  const record = {
    ...recordRow,
    nickname: profile?.nickname ?? null,
    avatar_url: profile?.avatar_url ?? null,
  };

  const { data: media } = await result.supabaseAdmin
    .from("record_media")
    .select("id, media_type, url, created_at")
    .eq("record_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  return NextResponse.json({ record, media: media ?? [] });
};

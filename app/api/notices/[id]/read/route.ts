import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

type Params = {
  params: Promise<{ id: string }>;
};

export const POST = async (request: Request, { params }: Params) => {
  const { user, supabaseAdmin, errorResponse } = await getUserFromRequest(request);
  if (errorResponse || !user || !supabaseAdmin) {
    return errorResponse ?? NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const { data: notice, error: noticeError } = await supabaseAdmin
    .from("notices")
    .select("id")
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();

  if (noticeError) {
    console.error("Failed to validate notice", noticeError);
    return NextResponse.json({ message: "Failed to mark notice as read" }, { status: 500 });
  }

  if (!notice) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const readAt = new Date().toISOString();
  const { data: noticeRead, error: upsertError } = await supabaseAdmin
    .from("notice_reads")
    .upsert(
      {
        notice_id: id,
        user_id: user.id,
        read_at: readAt,
        updated_at: readAt,
      },
      { onConflict: "notice_id,user_id" }
    )
    .select("notice_id,read_at")
    .single();

  if (upsertError || !noticeRead) {
    console.error("Failed to mark notice as read", upsertError);
    return NextResponse.json({ message: "Failed to mark notice as read" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    notice_id: noticeRead.notice_id,
    read_at: noticeRead.read_at,
  });
};

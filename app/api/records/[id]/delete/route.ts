import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

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

  const { error: updateError } = await auth.supabaseAdmin
    .from("records")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    console.error("Failed to delete record", updateError);
    return NextResponse.json(
      { message: "Failed to delete record" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};

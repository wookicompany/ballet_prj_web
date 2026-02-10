import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const DELETE = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } =
    await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    if (userError) {
      console.error("Failed to validate user token", userError);
    }
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data: record, error: recordError } = await supabaseAdmin
    .from("records")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (recordError) {
    console.error("Failed to load record", recordError);
    return NextResponse.json(
      { message: "Failed to load record" },
      { status: 500 }
    );
  }

  if (!record) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (record.user_id !== userData.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { error: updateError } = await supabaseAdmin
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

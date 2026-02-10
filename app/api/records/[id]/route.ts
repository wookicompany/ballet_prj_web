import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const pickRecordPayload = (body: Record<string, unknown>) => ({
  record_date: String(body.record_date ?? ""),
  start_time: String(body.start_time ?? ""),
  end_time: String(body.end_time ?? ""),
  content: typeof body.content === "string" ? body.content : "",
  mood:
    typeof body.mood === "string" || typeof body.mood === "number"
      ? body.mood
      : null,
  location: typeof body.location === "string" ? body.location : "",
  level: typeof body.level === "string" ? body.level : "",
  instructor: typeof body.instructor === "string" ? body.instructor : "",
  bar_order: typeof body.bar_order === "string" ? body.bar_order : "",
  center_order: typeof body.center_order === "string" ? body.center_order : "",
  did_well: typeof body.did_well === "string" ? body.did_well : "",
  improve_next: typeof body.improve_next === "string" ? body.improve_next : "",
});

export const PATCH = async (
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

  if (record.user_id !== userData.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const payload = pickRecordPayload(body ?? {});
  const moodValue = Number(payload.mood);

  if (
    !payload.record_date ||
    !payload.start_time ||
    !payload.end_time ||
    payload.mood === null ||
    !Number.isFinite(moodValue) ||
    !Number.isInteger(moodValue) ||
    moodValue < 1 ||
    moodValue > 5
  ) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("records")
    .update(payload)
    .eq("id", id)
    .is("deleted_at", null);

  if (updateError) {
    console.error("Failed to update record", updateError);
    return NextResponse.json(
      { message: "Failed to update record" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};

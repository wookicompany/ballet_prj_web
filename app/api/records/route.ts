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

export const POST = async (request: Request) => {
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

  const normalizedPayload = { ...payload, mood: moodValue };

  const { data, error } = await supabaseAdmin
    .from("records")
    .insert({
      user_id: userData.user.id,
      ...normalizedPayload,
    })
    .select("id, record_date")
    .single();

  if (error || !data) {
    console.error("Failed to create record", error);
    return NextResponse.json(
      { message: "Failed to create record" },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: data.id, record_date: data.record_date });
};

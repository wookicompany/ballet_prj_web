import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

type CalendarSettingsBody = {
  calendar_week_start_monday?: boolean;
  calendar_highlight_weekend?: boolean;
};

export const PATCH = async (request: Request) => {
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.supabaseAdmin || !auth.user) {
    return auth.errorResponse ?? NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: CalendarSettingsBody;
  try {
    body = (await request.json()) as CalendarSettingsBody;
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const hasWeekStart = Object.prototype.hasOwnProperty.call(body, "calendar_week_start_monday");
  const hasHighlight = Object.prototype.hasOwnProperty.call(body, "calendar_highlight_weekend");

  if (!hasWeekStart && !hasHighlight) {
    return NextResponse.json({ message: "No fields to update" }, { status: 400 });
  }

  if (hasWeekStart && typeof body.calendar_week_start_monday !== "boolean") {
    return NextResponse.json({ message: "calendar_week_start_monday must be boolean" }, { status: 400 });
  }
  if (hasHighlight && typeof body.calendar_highlight_weekend !== "boolean") {
    return NextResponse.json({ message: "calendar_highlight_weekend must be boolean" }, { status: 400 });
  }

  const payload: {
    id: string;
    calendar_week_start_monday?: boolean;
    calendar_highlight_weekend?: boolean;
  } = { id: auth.user.id };

  if (hasWeekStart) payload.calendar_week_start_monday = body.calendar_week_start_monday;
  if (hasHighlight) payload.calendar_highlight_weekend = body.calendar_highlight_weekend;

  const { error } = await auth.supabaseAdmin.from("profiles").upsert(payload);

  if (error) {
    console.error("Failed to update calendar settings", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
};

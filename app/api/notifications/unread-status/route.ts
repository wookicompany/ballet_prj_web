import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

export const GET = async (request: Request) => {
  const { user, supabaseAdmin, errorResponse } = await getUserFromRequest(request);
  if (errorResponse || !user || !supabaseAdmin) {
    return errorResponse ?? NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("user_notifications")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_read", false)
    .limit(1);

  if (error) {
    console.error("[notifications/unread-status] fetch failed", error);
    return NextResponse.json({ message: "Failed to load unread status" }, { status: 500 });
  }

  return NextResponse.json({ has_unread: (data ?? []).length > 0 });
};

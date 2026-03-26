import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

export const POST = async (request: Request) => {
  const { user, supabaseAdmin, errorResponse } = await getUserFromRequest(request);
  if (errorResponse || !user || !supabaseAdmin) {
    return errorResponse ?? NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from("user_notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) {
    console.error("[notifications/read-all] update failed", error);
    return NextResponse.json({ message: "Failed to mark notifications as read" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
};

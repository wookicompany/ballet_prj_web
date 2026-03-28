import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";
import { isValidExpoPushTokenFormat } from "@/lib/expoPush";

export const POST = async (request: Request) => {
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  const body = await request.json();
  if (typeof body?.expo_push_token !== "string") {
    return NextResponse.json(
      { message: "expo_push_token is required" },
      { status: 422 }
    );
  }

  const rawToken = body.expo_push_token.trim();
  if (rawToken !== "" && !isValidExpoPushTokenFormat(rawToken)) {
    return NextResponse.json(
      { message: "expo_push_token format is invalid" },
      { status: 422 }
    );
  }

  const action = rawToken === "" ? "unregister" : "register_or_refresh";
  const { data, error } = await auth.supabaseAdmin
    .from("profiles")
    .update({ expo_push_token: rawToken || null })
    .eq("id", auth.user.id)
    .is("deleted_at", null)
    .select("id")
    .single();

  if (error || !data) {
    console.error(`[EXPO_PUSH_TOKEN] ${action} failed`, {
      userId: auth.user.id,
      error,
    });
    return NextResponse.json(
      { message: "Failed to update expo push token" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, action });
};

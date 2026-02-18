import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

/**
 * FCM 토큰 등록/갱신. RN 앱이 로그인·토큰 갱신 시 호출.
 * @see docs/rn_webview_integration.md, docs/rn_webview_integration_plan.md
 */
export const POST = async (request: Request) => {
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  const body = await request.json();
  const fcmToken =
    typeof body?.fcm_token === "string" ? body.fcm_token.trim() : "";
  const action = fcmToken ? "register_or_refresh" : "unregister";

  const { data, error } = await auth.supabaseAdmin
    .from("profiles")
    .update({ fcm_token: fcmToken || null })
    .eq("id", auth.user.id)
    .select("id")
    .single();

  if (error || !data) {
    console.error(`[FCM_TOKEN] ${action} failed`, {
      userId: auth.user.id,
      error,
    });
    return NextResponse.json(
      { message: "Failed to update fcm token" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
};

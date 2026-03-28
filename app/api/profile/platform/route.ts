import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

const ALLOWED_PLATFORMS = new Set(["ios", "android"]);

export const POST = async (request: Request) => {
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  const body = await request.json().catch(() => null);
  const appPlatform =
    typeof body?.app_platform === "string" ? body.app_platform.trim().toLowerCase() : "";

  if (!ALLOWED_PLATFORMS.has(appPlatform)) {
    return NextResponse.json(
      { message: "app_platform must be ios or android" },
      { status: 422 }
    );
  }

  const { data, error } = await auth.supabaseAdmin
    .from("profiles")
    .update({
      app_platform: appPlatform,
      app_platform_updated_at: new Date().toISOString(),
    })
    .eq("id", auth.user.id)
    .is("deleted_at", null)
    .select("id")
    .single();

  if (error || !data) {
    console.error("[PROFILE_PLATFORM] update failed", {
      userId: auth.user.id,
      error,
    });
    return NextResponse.json(
      { message: "Failed to update platform" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, app_platform: appPlatform });
};

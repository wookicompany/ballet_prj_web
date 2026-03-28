import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const POST = async (request: Request) => {
  const body = await request.json().catch(() => null);
  const userIdsRaw: unknown[] = Array.isArray(body?.user_ids) ? body.user_ids : [];
  const userIds = Array.from(
    new Set(
      userIdsRaw
        .filter((value: unknown): value is string => typeof value === "string")
        .map((value: string) => value.trim())
        .filter(Boolean)
    )
  ).slice(0, 100);

  if (userIds.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,nickname,avatar_url")
    .in("id", userIds)
    .is("deleted_at", null);

  if (error) {
    console.error("Failed to load public profiles", error);
    return NextResponse.json(
      { message: "Failed to load public profiles" },
      { status: 500 }
    );
  }

  return NextResponse.json({ items: data ?? [] });
};

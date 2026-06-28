import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

export const POST = async (request: Request) => {
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.supabaseAdmin || !auth.user) {
    return auth.errorResponse ?? NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: unknown };
  try {
    body = (await request.json()) as { name?: unknown };
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const raw = typeof body.name === "string" ? body.name.trim() : "";
  if (!raw) {
    return NextResponse.json({ message: "무용수 이름을 입력해 주세요." }, { status: 400 });
  }
  if (raw.length > 20) {
    return NextResponse.json({ message: "무용수 이름은 최대 20자까지 가능합니다." }, { status: 400 });
  }

  const { data, error } = await auth.supabaseAdmin
    .from("favorite_dancers")
    .insert({ user_id: auth.user.id, name: raw })
    .select("id, name, created_at")
    .single();

  if (error || !data) {
    console.error("Failed to insert favorite dancer", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ item: data });
};

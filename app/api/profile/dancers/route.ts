import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

type Body = {
  favorite_dancer_1?: string | null;
  favorite_dancer_2?: string | null;
};

export const PATCH = async (request: Request) => {
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.supabaseAdmin || !auth.user) {
    return auth.errorResponse ?? NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const has1 = Object.prototype.hasOwnProperty.call(body, "favorite_dancer_1");
  const has2 = Object.prototype.hasOwnProperty.call(body, "favorite_dancer_2");

  if (!has1 && !has2) {
    return NextResponse.json({ message: "No fields to update" }, { status: 400 });
  }

  const payload: { id: string; favorite_dancer_1?: string | null; favorite_dancer_2?: string | null } = {
    id: auth.user.id,
  };

  if (has1) {
    const raw = typeof body.favorite_dancer_1 === "string" ? body.favorite_dancer_1.trim() : null;
    if (raw && raw.length > 20) {
      return NextResponse.json({ message: "무용수 이름은 최대 20자까지 가능합니다." }, { status: 400 });
    }
    payload.favorite_dancer_1 = raw || null;
  }

  if (has2) {
    const raw = typeof body.favorite_dancer_2 === "string" ? body.favorite_dancer_2.trim() : null;
    if (raw && raw.length > 20) {
      return NextResponse.json({ message: "무용수 이름은 최대 20자까지 가능합니다." }, { status: 400 });
    }
    payload.favorite_dancer_2 = raw || null;
  }

  const { error } = await auth.supabaseAdmin.from("profiles").upsert(payload);

  if (error) {
    console.error("Failed to update dancer names", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
};

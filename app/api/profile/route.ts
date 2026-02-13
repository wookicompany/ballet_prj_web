import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

type ProfileUpdateBody = {
  nickname?: string | null;
  avatar_url?: string | null;
};

export const PATCH = async (request: Request) => {
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.supabaseAdmin || !auth.user) {
    return auth.errorResponse ?? NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: ProfileUpdateBody;
  try {
    body = (await request.json()) as ProfileUpdateBody;
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const normalizedNickname =
    typeof body.nickname === "string" ? body.nickname.trim() : "";
  const nextNickname = normalizedNickname.length ? normalizedNickname : null;
  const nextAvatarUrl =
    typeof body.avatar_url === "string"
      ? body.avatar_url.trim() || null
      : null;

  if (normalizedNickname.length > 12) {
    return NextResponse.json(
      { message: "닉네임은 최대 12자까지 가능합니다." },
      { status: 400 }
    );
  }

  if (nextNickname) {
    const { data: duplicatedRows, error: duplicateCheckError } =
      await auth.supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("nickname", nextNickname)
        .neq("id", auth.user.id)
        .limit(1);

    if (duplicateCheckError) {
      console.error("Failed to check duplicated nickname", duplicateCheckError);
      return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }

    if ((duplicatedRows ?? []).length > 0) {
      return NextResponse.json(
        { message: "중복된 닉네임이에요." },
        { status: 409 }
      );
    }
  }

  const { error: updateError } = await auth.supabaseAdmin
    .from("profiles")
    .upsert({
      id: auth.user.id,
      nickname: nextNickname,
      avatar_url: nextAvatarUrl,
    });

  if (updateError) {
    console.error("Failed to update profile", updateError);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
};

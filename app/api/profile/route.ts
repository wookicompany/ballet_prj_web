import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";
import { getSeoulDateParts, parseDateKey } from "@/lib/kstDateTime";

type ProfileUpdateBody = {
  nickname?: string | null;
  avatar_url?: string | null;
  ballet_started_at?: string | null;
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
  const hasBalletStartedAt = Object.prototype.hasOwnProperty.call(
    body,
    "ballet_started_at"
  );
  let nextBalletStartedAt: string | null | undefined = undefined;

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

  if (hasBalletStartedAt) {
    if (body.ballet_started_at === null) {
      nextBalletStartedAt = null;
    } else if (typeof body.ballet_started_at === "string") {
      const normalizedStartDate = body.ballet_started_at.trim();
      if (!normalizedStartDate) {
        nextBalletStartedAt = null;
      } else {
        const isDateKeyFormat = /^\d{4}-\d{2}-\d{2}$/.test(normalizedStartDate);
        const parsed = parseDateKey(normalizedStartDate);
        if (!isDateKeyFormat || !parsed) {
          return NextResponse.json(
            { message: "발레 시작일 형식이 올바르지 않습니다." },
            { status: 400 }
          );
        }

        const { year, month, day } = getSeoulDateParts();
        const today = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (normalizedStartDate > today) {
          return NextResponse.json(
            { message: "발레 시작일은 미래 날짜로 설정할 수 없습니다." },
            { status: 400 }
          );
        }
        nextBalletStartedAt = normalizedStartDate;
      }
    } else {
      return NextResponse.json(
        { message: "발레 시작일 형식이 올바르지 않습니다." },
        { status: 400 }
      );
    }
  }

  const payload: {
    id: string;
    nickname: string | null;
    avatar_url: string | null;
    ballet_started_at?: string | null;
  } = {
    id: auth.user.id,
    nickname: nextNickname,
    avatar_url: nextAvatarUrl,
  };
  if (nextBalletStartedAt !== undefined) {
    payload.ballet_started_at = nextBalletStartedAt;
  }

  const { data: existingProfile, error: profileFetchError } =
    await auth.supabaseAdmin
      .from("profiles")
      .select("deleted_at")
      .eq("id", auth.user.id)
      .maybeSingle();

  if (profileFetchError) {
    console.error("Failed to fetch profile", profileFetchError);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
  if (existingProfile?.deleted_at) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const { error: updateError } = await auth.supabaseAdmin
    .from("profiles")
    .upsert(payload);

  if (updateError) {
    console.error("Failed to update profile", updateError);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
};

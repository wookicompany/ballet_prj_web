import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";
import { getOAuthProvider } from "@/lib/oauthProvider";

export const GET = async (request: Request) => {
  const { user, supabaseAdmin, errorResponse } = await getUserFromRequest(request);
  if (errorResponse || !user || !supabaseAdmin) {
    return (
      errorResponse ?? NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    );
  }

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("nickname, avatar_url, deleted_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("account me profile", error);
    return NextResponse.json(
      { message: "계정 정보를 불러오지 못했어요." },
      { status: 500 }
    );
  }

  if (profile?.deleted_at) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    account: {
      avatar_url: profile?.avatar_url ?? null,
      nickname: profile?.nickname ?? null,
      email: user.email ?? null,
      provider: getOAuthProvider(user),
      created_at: user.created_at ?? null,
    },
  });
};

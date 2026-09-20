import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// 조회·클릭 추적처럼 "로그인했으면 누군지 남기고, 아니어도 그냥 진행"해야 하는 곳에서 쓴다.
// getUserFromRequest는 토큰이 없으면 401을 돌려주므로 여기 쓰면 비로그인 방문자의 조회가
// 통째로 막힌다. 토큰이 없거나 검증에 실패하면 user를 null로 두고 호출부가 계속 진행한다.
export const getOptionalUserFromRequest = async (
  request: Request
): Promise<{ user: { id: string } | null }> => {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!token) return { user: null };

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return { user: null };
    return { user: { id: data.user.id } };
  } catch {
    // 인증 서버가 흔들려도 추적 자체는 계속돼야 한다 — 익명으로 기록한다.
    return { user: null };
  }
};

export const getUserFromRequest = async (request: Request) => {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return {
      user: null,
      supabaseAdmin: null,
      errorResponse: NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } =
    await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    if (userError) {
      console.error("Failed to validate user token", userError);
    }
    return {
      user: null,
      supabaseAdmin: null,
      errorResponse: NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  return { user: userData.user, supabaseAdmin, errorResponse: null };
};

export type AdminFromRequest =
  | { admin: true; user: NonNullable<Awaited<ReturnType<typeof getUserFromRequest>>["user"]>; supabaseAdmin: NonNullable<Awaited<ReturnType<typeof getUserFromRequest>>["supabaseAdmin"]> }
  | { admin: false; errorResponse: Response };

export const getAdminFromRequest = async (request: Request): Promise<AdminFromRequest> => {
  const { user, supabaseAdmin, errorResponse } = await getUserFromRequest(request);
  if (errorResponse || !user || !supabaseAdmin) {
    return { admin: false, errorResponse: errorResponse ?? new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } }) };
  }
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  // 조회 실패와 권한 없음을 구분한다. 둘 다 403으로 뭉뚱그리면 Supabase가 잠깐 흔들릴 때
  // 어드민이 "권한 없음"으로 판정돼 화면에서 쫓겨난다(2026-09-14 실제 발생).
  if (error) {
    console.error("Failed to load admin profile", error);
    return { admin: false, errorResponse: new Response(JSON.stringify({ message: "Failed to verify admin" }), { status: 503, headers: { "Content-Type": "application/json" } }) };
  }
  if (!profile?.is_admin) {
    return { admin: false, errorResponse: new Response(JSON.stringify({ message: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } }) };
  }
  return { admin: true, user, supabaseAdmin };
};

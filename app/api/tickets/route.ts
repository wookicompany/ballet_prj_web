import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";
import { isValidDateKey } from "@/lib/kstDateTime";

const toNullableText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export const POST = async (request: Request) => {
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  const body = await request.json();

  const performanceId = toNullableText(body?.performance_id);
  // 직접 입력은 사용자가 타이핑한 값이라 공백만 넣는 우회가 가능하다.
  // 클라이언트 required만으로는 못 막으므로 서버에서 trim 후 판정한다.
  const customTitle = toNullableText(body?.custom_title);
  const customVenue = toNullableText(body?.custom_venue);
  const watchedOn = typeof body?.watched_on === "string" ? body.watched_on : "";
  const seat = toNullableText(body?.seat);

  if (!isValidDateKey(watchedOn)) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  // DB의 performance_tickets_source_check와 이중화 — 둘 중 하나는 반드시 있어야 한다.
  if (!performanceId && !customTitle) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  // 별점은 선택 항목이라 null이 정상이다. 값이 있으면 리뷰와 같은 스케일(0~10 짝수, 별 1개 = 2).
  // 리뷰 POST의 검증(항상 2~10 필수)을 그대로 복사하면 안 된다.
  let rating: number | null = null;
  if (body?.rating !== null && body?.rating !== undefined) {
    const parsed = Number(body.rating);
    if (
      !Number.isFinite(parsed) ||
      !Number.isInteger(parsed) ||
      parsed < 0 ||
      parsed > 10 ||
      parsed % 2 !== 0
    ) {
      return NextResponse.json({ message: "Bad request" }, { status: 400 });
    }
    rating = parsed === 0 ? null : parsed;
  }

  const { data, error } = await auth.supabaseAdmin
    .from("performance_tickets")
    .insert({
      user_id: auth.user.id,
      // KOPIS 공연을 고른 경우 직접 입력값은 저장하지 않는다(공연 정보는 조인으로 읽는다).
      performance_id: performanceId,
      custom_title: performanceId ? null : customTitle,
      custom_venue: performanceId ? null : customVenue,
      watched_on: watchedOn,
      rating,
      seat,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to create ticket", error);
    return NextResponse.json(
      { message: "Failed to create ticket" },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: data.id });
};

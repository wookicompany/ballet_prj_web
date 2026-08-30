import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";
import { isValidDateKey } from "@/lib/kstDateTime";

const TIME_PATTERN = /^\d{2}:\d{2}$/;
const VALID_WEEKDAYS = new Set([0, 1, 2, 3, 4, 5, 6]);

// Omitted (undefined), not null, matches the RPC's generated Args type (optional params) —
// PostgREST treats an omitted key the same as the function's own `DEFAULT NULL`.
const toNullableString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

// §11.2/§11.4/§11.7: parent record_recurrences + child planned records are created atomically
// by the create_record_recurrences RPC (SECURITY DEFINER, dedup via ON CONFLICT DO NOTHING on
// records_user_date_start_dedup_idx, orphan-parent guard on created=0). This route only owns
// request validation + auth; the RPC re-validates/re-caps everything server-side (§12.1).
export const POST = async (request: Request) => {
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  const weekdays = Array.isArray(b.weekdays)
    ? Array.from(
        new Set(
          b.weekdays.filter(
            (w): w is number => typeof w === "number" && Number.isInteger(w)
          )
        )
      )
    : [];
  const startTime = typeof b.start_time === "string" ? b.start_time : "";
  const endTime = typeof b.end_time === "string" ? b.end_time : "";
  // PM follow-up (user-selectable start date, replacing the old "always today" assumption):
  // optional for backward compatibility with any caller that omits it — the RPC itself still
  // defaults to today when p_starts_on is not supplied.
  const startDate = typeof b.start_date === "string" ? b.start_date : "";
  const untilDate = typeof b.until_date === "string" ? b.until_date : "";
  const clientRequestId =
    typeof b.client_request_id === "string" ? b.client_request_id.trim() : "";

  if (
    weekdays.length === 0 ||
    !weekdays.every((w) => VALID_WEEKDAYS.has(w)) ||
    !TIME_PATTERN.test(startTime) ||
    !TIME_PATTERN.test(endTime) ||
    endTime <= startTime ||
    (startDate !== "" && !isValidDateKey(startDate)) ||
    !isValidDateKey(untilDate) ||
    !clientRequestId ||
    clientRequestId.length > 200
  ) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  // p_starts_on: the user-selected start date. The create_record_recurrences RPC takes an
  // optional `p_starts_on date DEFAULT NULL` and server-clamps it to `GREATEST(p_starts_on,
  // today KST)` (never past — D5). Migration applied to Supabase 2026-08-30
  // (recurrences_add_optional_p_starts_on). Omitting it (empty start date) keeps the RPC's
  // "start from today" default, so older callers stay backward compatible.
  const rpcParams = {
    p_user_id: auth.user.id,
    p_weekdays: weekdays,
    p_start_time: startTime,
    p_end_time: endTime,
    p_until_date: untilDate,
    p_client_request_id: clientRequestId,
    p_location: toNullableString(b.location),
    p_instructor: toNullableString(b.instructor),
    p_level: toNullableString(b.level),
    p_bar_order: toNullableString(b.bar_order),
    p_center_order: toNullableString(b.center_order),
    p_starts_on: startDate || undefined,
  };

  let { data, error } = await auth.supabaseAdmin
    .rpc("create_record_recurrences", rpcParams)
    .single();

  // L1: two concurrent requests with the same client_request_id can both pass the RPC's own
  // replay check (SELECT ... WHERE client_request_id = ...) before either has committed its
  // INSERT into record_recurrences — the loser then hits the (user_id, client_request_id)
  // unique constraint instead of the replay branch. By the time that 23505 surfaces here the
  // winner's row is already committed (Postgres blocks the losing INSERT on the unique index
  // until the winner commits, then re-checks), so re-running the RPC now deterministically
  // takes the replay branch and returns the winner's group instead of a 500.
  if (error?.code === "23505") {
    const replay = await auth.supabaseAdmin
      .rpc("create_record_recurrences", rpcParams)
      .single();
    data = replay.data;
    error = replay.error;
  }

  if (error || !data) {
    console.error("Failed to create record recurrences", error);
    // RPC의 RAISE EXCEPTION(P0001) 마커를 message뿐 아니라 details/hint까지 훑어 매핑한다 —
    // PostgREST가 예외 텍스트를 어느 필드에 싣든(구현/버전 차) 500으로 새지 않도록 견고화.
    const rpcErrorText = [error?.message, error?.details, error?.hint]
      .filter(Boolean)
      .join(" ");
    if (rpcErrorText.includes("RECURRING_INVALID_INPUT")) {
      return NextResponse.json({ message: "Bad request" }, { status: 400 });
    }
    if (rpcErrorText.includes("RECURRING_ZERO_CREATED")) {
      // #16/§9.6: all candidate dates collided with existing records — same "0건" UX as the
      // zero-matching-date case below, so callers only need to branch on `created.length`.
      return NextResponse.json({ created: [], skipped: [] });
    }
    return NextResponse.json(
      { message: "Failed to create record recurrences" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      recurrenceId: data.recurrence_id,
      created: data.created ?? [],
      skipped: data.skipped ?? [],
    },
    // 201 only for an actual new group; a replayed idempotency key or a zero-candidate result
    // (data.recurrence_id is null in that case) are both "nothing new was created" responses.
    { status: data.recurrence_id && !data.replayed ? 201 : 200 }
  );
};

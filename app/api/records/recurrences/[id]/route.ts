import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

// §11.8 "남은 예정 전체 삭제": cancels every still-planned child of a recurrence group in a
// single atomic UPDATE. done rows and already-cancelled/deleted rows are untouched (D6, §6.4 #21).
export const DELETE = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  // Ownership check first (CLAUDE.md pattern: 404 if absent, 403 if someone else's) — the
  // deleting UPDATE below is *also* scoped to user_id (§11.8 G5), so ownership is enforced
  // twice; this pre-check exists purely to return the correct 404 vs 403 status.
  const { data: recurrence, error: recurrenceError } = await auth.supabaseAdmin
    .from("record_recurrences")
    .select("id, user_id, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (recurrenceError) {
    console.error("Failed to load record recurrence", recurrenceError);
    return NextResponse.json(
      { message: "Failed to load record recurrence" },
      { status: 500 }
    );
  }

  if (!recurrence || recurrence.deleted_at) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (recurrence.user_id !== auth.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  // §11.8 G5 (IDOR guard): user_id is included in the WHERE clause of the single UPDATE that
  // performs the actual cancellation, not relied upon solely from the pre-check above.
  const { data: cancelled, error: updateError } = await auth.supabaseAdmin
    .from("records")
    .update({ deleted_at: new Date().toISOString() })
    .eq("recurrence_id", id)
    .eq("user_id", auth.user.id)
    .eq("status", "planned")
    .is("deleted_at", null)
    .select("record_date");

  if (updateError) {
    console.error("Failed to cancel remaining recurrence records", updateError);
    return NextResponse.json(
      { message: "일부 예정을 삭제하지 못했어요. 다시 시도해 주세요." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    cancelledDates: (cancelled ?? []).map((row) => row.record_date),
  });
};

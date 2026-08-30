import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";
import { formatSeoulDateKey, isValidDateKey } from "@/lib/kstDateTime";

const pickRecordPayload = (body: Record<string, unknown>) => ({
  record_date: String(body.record_date ?? ""),
  start_time: String(body.start_time ?? ""),
  end_time: String(body.end_time ?? ""),
  content: typeof body.content === "string" ? body.content : "",
  mood:
    typeof body.mood === "string" || typeof body.mood === "number"
      ? body.mood
      : null,
  location: typeof body.location === "string" ? body.location : "",
  level: typeof body.level === "string" ? body.level : "",
  instructor: typeof body.instructor === "string" ? body.instructor : "",
  bar_order: typeof body.bar_order === "string" ? body.bar_order : "",
  center_order: typeof body.center_order === "string" ? body.center_order : "",
  did_well: typeof body.did_well === "string" ? body.did_well : "",
  improve_next: typeof body.improve_next === "string" ? body.improve_next : "",
  memo: typeof body.memo === "string" ? body.memo : "",
  outfit: typeof body.outfit === "string" ? body.outfit : "",
  workout_activity_label:
    typeof body.workout_activity_label === "string"
      ? body.workout_activity_label
      : null,
  workout_source_name:
    typeof body.workout_source_name === "string" ? body.workout_source_name : null,
  workout_device_name:
    typeof body.workout_device_name === "string" ? body.workout_device_name : null,
  workout_active_energy_kcal:
    typeof body.workout_active_energy_kcal === "string" ||
    typeof body.workout_active_energy_kcal === "number"
      ? body.workout_active_energy_kcal
      : null,
  workout_total_energy_kcal:
    typeof body.workout_total_energy_kcal === "string" ||
    typeof body.workout_total_energy_kcal === "number"
      ? body.workout_total_energy_kcal
      : null,
  workout_avg_bpm:
    typeof body.workout_avg_bpm === "string" || typeof body.workout_avg_bpm === "number"
      ? body.workout_avg_bpm
      : null,
  workout_max_bpm:
    typeof body.workout_max_bpm === "string" || typeof body.workout_max_bpm === "number"
      ? body.workout_max_bpm
      : null,
});

const parseNullableNumber = (value: string | number | null) => {
  if (value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

// Postgres `time` columns come back as "HH:MM:SS" while clients send "HH:MM" — normalize to
// minute precision so the §11.5 unchanged-fields comparison doesn't false-positive on format.
const normalizeTimeValue = (value: unknown): unknown =>
  typeof value === "string" ? value.slice(0, 5) : value;

const parseNullableBpm = (value: string | number | null) => {
  const parsed = parseNullableNumber(value);
  if (parsed === null) return null;
  if (!Number.isFinite(parsed)) return NaN;
  if (parsed <= 0) return null;
  return Math.round(parsed);
};

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  const { data: record, error: recordError } = await auth.supabaseAdmin
    .from("records")
    .select(
      "id, user_id, deleted_at, updated_at, record_date, start_time, end_time, content, mood, location, level, instructor, bar_order, center_order, did_well, improve_next, memo, outfit, workout_activity_label, workout_source_name, workout_device_name, workout_active_energy_kcal, workout_total_energy_kcal, workout_avg_bpm, workout_max_bpm"
    )
    .eq("id", id)
    .maybeSingle();

  if (recordError) {
    console.error("Failed to load record", recordError);
    return NextResponse.json(
      { message: "Failed to load record" },
      { status: 500 }
    );
  }

  if (!record || record.deleted_at) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (record.user_id !== auth.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const payload = pickRecordPayload(body ?? {});
  // M6: editing a planned record preserves its planned-ness — mood stays optional. Callers
  // signal "this is a planned edit, don't require mood" the same way as POST: `status:
  // "planned"`. Omitted (older clients, or editing an already-done record) keeps the
  // pre-existing "mood required" behavior.
  const isPlannedIntent =
    typeof body?.status === "string" && body.status === "planned";
  // P1/§9.4/#13: "무드 없이 완료 처리" — explicit completion intent without a mood value.
  // Signaled either by `status: "done"` or `complete: true`. Unlike the mood-driven path, the
  // API here writes `status: 'done'` itself so the records_enforce_status_monotonic DB trigger
  // can coerce NEW.status to 'done' even when mood stays null (see updatePayload below).
  const isCompleteIntent =
    (typeof body?.status === "string" && body.status === "done") ||
    body?.complete === true;
  const workoutActiveEnergy = parseNullableNumber(payload.workout_active_energy_kcal);
  const workoutTotalEnergy = parseNullableNumber(payload.workout_total_energy_kcal);
  const workoutAvgBpm = parseNullableBpm(payload.workout_avg_bpm);
  const workoutMaxBpm = parseNullableBpm(payload.workout_max_bpm);

  let moodValue: number | null = null;
  if (payload.mood !== null) {
    const parsedMood = Number(payload.mood);
    if (
      !Number.isFinite(parsedMood) ||
      !Number.isInteger(parsedMood) ||
      parsedMood < 1 ||
      parsedMood > 8
    ) {
      return NextResponse.json({ message: "Bad request" }, { status: 400 });
    }
    moodValue = parsedMood;
  } else if (!isPlannedIntent && !isCompleteIntent) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  if (
    !payload.record_date ||
    !isValidDateKey(payload.record_date) ||
    !payload.start_time ||
    !payload.end_time ||
    Number.isNaN(workoutActiveEnergy) ||
    Number.isNaN(workoutTotalEnergy) ||
    Number.isNaN(workoutAvgBpm) ||
    Number.isNaN(workoutMaxBpm) ||
    (workoutActiveEnergy !== null && workoutActiveEnergy < 0) ||
    (workoutTotalEnergy !== null && workoutTotalEnergy < 0) ||
    (workoutAvgBpm !== null && workoutAvgBpm <= 0) ||
    (workoutMaxBpm !== null && workoutMaxBpm <= 0)
  ) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  // D5 (extended to edits): a record can't be moved into the past while still planned.
  if (isPlannedIntent && payload.record_date < formatSeoulDateKey()) {
    return NextResponse.json(
      { message: "예정은 오늘 이후 날짜로만 옮길 수 있어요." },
      { status: 400 }
    );
  }

  const normalizedPayload = {
    ...payload,
    mood: moodValue,
    workout_active_energy_kcal: workoutActiveEnergy,
    workout_total_energy_kcal: workoutTotalEnergy,
    workout_avg_bpm: workoutAvgBpm,
    workout_max_bpm: workoutMaxBpm,
  };

  // §11.5: optimistic concurrency check. Only enforced when the caller sends
  // `expected_updated_at` (older clients that don't send it keep the pre-existing
  // last-write-wins behavior — no regression). A stale `updated_at` is only a real conflict
  // if the fields we're about to write actually differ from the current row — otherwise this
  // is #12's idempotent double-submit (e.g. a fast double-tap), not #41's cross-session race,
  // and must not be rejected (§11.5 explicit warning against conflating the two).
  const expectedUpdatedAt =
    typeof body?.expected_updated_at === "string" ? body.expected_updated_at : null;
  if (expectedUpdatedAt && expectedUpdatedAt !== record.updated_at) {
    const fieldsUnchanged = (
      Object.keys(normalizedPayload) as Array<keyof typeof normalizedPayload>
    ).every((key) => {
      let currentValue: unknown = (record as Record<string, unknown>)[key];
      let nextValue: unknown = normalizedPayload[key];
      if (key === "start_time" || key === "end_time") {
        currentValue = normalizeTimeValue(currentValue);
        nextValue = normalizeTimeValue(nextValue);
      }
      // Numeric workout fields may come back as strings from Postgres numeric columns.
      if (typeof currentValue === "number" || typeof nextValue === "number") {
        return (
          Number(currentValue ?? NaN) === Number(nextValue ?? NaN) ||
          (currentValue == null && nextValue == null)
        );
      }
      // Optional text fields: DB may hold NULL for never-touched columns while the payload
      // always normalizes missing values to "" — treat null and "" as equivalent here.
      if ((currentValue ?? "") === "" && (nextValue ?? "") === "") return true;
      return currentValue === nextValue;
    });

    if (!fieldsUnchanged) {
      return NextResponse.json(
        { message: "다른 기기에서 방금 이 기록이 바뀌었어요. 새로고침해 주세요." },
        { status: 409 }
      );
    }
  }

  // P1: only the completion-intent path writes `status`. Kept out of `normalizedPayload` (and
  // thus out of the §11.5 expected_updated_at diff above) because `record` doesn't select
  // `status` — adding it there would compare against `undefined` and false-positive a conflict.
  const updatePayload = isCompleteIntent
    ? { ...normalizedPayload, status: "done" as const }
    : normalizedPayload;

  const { error: updateError } = await auth.supabaseAdmin
    .from("records")
    .update(updatePayload)
    .eq("id", id)
    .is("deleted_at", null);

  if (updateError) {
    console.error("Failed to update record", updateError);
    if (updateError.code === "23505") {
      // records_user_date_start_dedup_idx (§11.2): same date+start_time already exists.
      return NextResponse.json(
        { message: "같은 날짜·시간에 이미 다른 기록이 있어요." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: "Failed to update record" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};

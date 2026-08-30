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

const parseNullableBpm = (value: string | number | null) => {
  const parsed = parseNullableNumber(value);
  if (parsed === null) return null;
  if (!Number.isFinite(parsed)) return NaN;
  if (parsed <= 0) return null;
  return Math.round(parsed);
};

export const POST = async (request: Request) => {
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  const body = await request.json();
  const payload = pickRecordPayload(body ?? {});
  // M6 / D5: an explicit `status: "planned"` intent relaxes mood validation (mood may be
  // omitted/null — the records_enforce_status_monotonic DB trigger derives status from mood
  // presence on INSERT, so we never set `status` ourselves). Any other value (including
  // omitted, for backward compat with older clients) keeps the existing "done" behavior
  // where mood is required.
  const isPlannedIntent =
    typeof body?.status === "string" && body.status === "planned";
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
  } else if (!isPlannedIntent) {
    // Non-planned (done) creation still requires mood, matching pre-existing behavior.
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

  // D5: a planned record can't be created in the past (KST).
  if (isPlannedIntent && payload.record_date < formatSeoulDateKey()) {
    return NextResponse.json(
      { message: "예정은 오늘 이후 날짜에만 만들 수 있어요." },
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

  const { data, error } = await auth.supabaseAdmin
    .from("records")
    .insert({
      user_id: auth.user.id,
      ...normalizedPayload,
    })
    .select("id, record_date")
    .single();

  if (error || !data) {
    console.error("Failed to create record", error);
    if (error?.code === "23505") {
      // records_user_date_start_dedup_idx (§11.2): same date+start_time already exists.
      return NextResponse.json(
        { message: "같은 날짜·시간에 이미 기록이 있어요." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: "Failed to create record" },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: data.id, record_date: data.record_date });
};

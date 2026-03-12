import type { Json } from "@/lib/database.types";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type CronRunStatus = "running" | "success" | "failed";

export const startCronRun = async ({
  jobName,
  scheduledSlot,
}: {
  jobName: string;
  scheduledSlot: string;
}) => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("cron_job_runs")
    .insert({
      job_name: jobName,
      scheduled_slot: scheduledSlot,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Failed to create cron job run log");
  }

  return data.id;
};

export const finishCronRun = async ({
  runId,
  status,
  counts,
  errorMessage,
}: {
  runId: string;
  status: Exclude<CronRunStatus, "running">;
  counts?: Json;
  errorMessage?: string | null;
}) => {
  const supabaseAdmin = getSupabaseAdmin();
  const finishedAtIso = new Date().toISOString();
  const { data: current, error: selectError } = await supabaseAdmin
    .from("cron_job_runs")
    .select("started_at")
    .eq("id", runId)
    .single();

  if (selectError || !current?.started_at) {
    throw new Error(selectError?.message ?? "Failed to read cron job run log");
  }

  const durationMs = Math.max(
    0,
    new Date(finishedAtIso).getTime() - new Date(current.started_at).getTime()
  );

  const { error: updateError } = await supabaseAdmin
    .from("cron_job_runs")
    .update({
      status,
      finished_at: finishedAtIso,
      duration_ms: durationMs,
      counts_json: counts ?? null,
      error_message: errorMessage ?? null,
    })
    .eq("id", runId);

  if (updateError) {
    throw new Error(updateError.message);
  }
};

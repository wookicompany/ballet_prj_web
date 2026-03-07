import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = {
  params: Promise<{ id: string }>;
};

const toMinutes = (time: string) => {
  const [hh, mm, ss] = time.split(":").map((value) => Number(value));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  return hh * 60 + mm + (Number.isFinite(ss) && ss ? Math.round(ss / 60) : 0);
};

export const GET = async (_request: Request, { params }: Params) => {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id,nickname,avatar_url,ballet_started_at")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to load profile summary", profileError);
      return NextResponse.json(
        { message: "Failed to load profile summary" },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    const [{ data: recordRows, error: recordError }, reviewCountResult] =
      await Promise.all([
        supabaseAdmin
          .from("records")
          .select("start_time,end_time")
          .eq("user_id", id)
          .is("deleted_at", null),
        supabaseAdmin
          .from("performance_reviews")
          .select("id", { count: "exact", head: true })
          .eq("user_id", id)
          .is("deleted_at", null),
      ]);

    if (recordError || reviewCountResult.error) {
      console.error("Failed to load profile summary stats", {
        recordError,
        reviewError: reviewCountResult.error,
      });
      return NextResponse.json(
        { message: "Failed to load profile summary" },
        { status: 500 }
      );
    }

    const rows = recordRows ?? [];
    const totalRecordMinutes = rows.reduce((sum, row) => {
      if (!row.start_time || !row.end_time) return sum;
      const diff = toMinutes(row.end_time) - toMinutes(row.start_time);
      if (diff <= 0) return sum;
      return sum + diff;
    }, 0);

    return NextResponse.json({
      item: {
        id: profile.id,
        nickname: profile.nickname,
        avatar_url: profile.avatar_url,
        ballet_started_at: profile.ballet_started_at,
        record_count: rows.length,
        total_record_minutes: totalRecordMinutes,
        review_count: reviewCountResult.count ?? 0,
      },
    });
  } catch (error) {
    console.error("Unexpected error while loading profile summary", error);
    return NextResponse.json(
      { message: "Failed to load profile summary" },
      { status: 500 }
    );
  }
};

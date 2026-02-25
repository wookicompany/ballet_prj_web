import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const GET = async () => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("notices")
      .select("id,title,published_at,created_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load notices", error);
      return NextResponse.json({ message: "Failed to load notices" }, { status: 500 });
    }

    return NextResponse.json({
      items: (data ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        published_at: item.published_at,
      })),
    });
  } catch (error) {
    console.error("Unexpected error while loading notices", error);
    return NextResponse.json({ message: "Failed to load notices" }, { status: 500 });
  }
};

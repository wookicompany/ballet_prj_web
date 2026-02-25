import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = {
  params: Promise<{ id: string }>;
};

export const GET = async (_request: Request, { params }: Params) => {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("notices")
      .select("id,title,content,published_at")
      .eq("id", id)
      .eq("is_published", true)
      .maybeSingle();

    if (error) {
      console.error("Failed to load notice detail", error);
      return NextResponse.json({ message: "Failed to load notice detail" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    console.error("Unexpected error while loading notice detail", error);
    return NextResponse.json({ message: "Failed to load notice detail" }, { status: 500 });
  }
};

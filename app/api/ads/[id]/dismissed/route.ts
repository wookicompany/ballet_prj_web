import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

type Params = {
  params: Promise<{ id: string }>;
};

export const GET = async (request: Request, { params }: Params) => {
  const { user, supabaseAdmin, errorResponse } = await getUserFromRequest(request);
  if (errorResponse || !user || !supabaseAdmin) {
    return errorResponse ?? NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("ad_dismissals")
    .select("ad_id")
    .eq("ad_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load ad dismissal status", error);
    return NextResponse.json({ message: "Failed to load dismissal status" }, { status: 500 });
  }

  return NextResponse.json({ dismissed: !!data });
};

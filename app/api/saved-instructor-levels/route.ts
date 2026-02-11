import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const getUserFromRequest = async (request: Request) => {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return {
      user: null,
      supabaseAdmin: null,
      errorResponse: NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } =
    await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    if (userError) {
      console.error("Failed to validate user token", userError);
    }
    return {
      user: null,
      supabaseAdmin: null,
      errorResponse: NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  return { user: userData.user, supabaseAdmin, errorResponse: null };
};

export const GET = async (request: Request) => {
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  const { data, error } = await auth.supabaseAdmin
    .from("saved_instructor_levels")
    .select("id, instructor, level, created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load saved instructor levels", error);
    return NextResponse.json(
      { message: "Failed to load saved instructor levels" },
      { status: 500 }
    );
  }

  return NextResponse.json({ items: data ?? [] });
};

export const POST = async (request: Request) => {
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  const body = await request.json();
  const instructor =
    typeof body?.instructor === "string" ? body.instructor.trim() : "";
  const level = typeof body?.level === "string" ? body.level.trim() : "";

  if (!instructor || !level) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  const { data, error } = await auth.supabaseAdmin
    .from("saved_instructor_levels")
    .insert({
      user_id: auth.user.id,
      instructor,
      level,
    })
    .select("id, instructor, level, created_at")
    .single();

  if (error || !data) {
    console.error("Failed to create saved instructor level", error);
    return NextResponse.json(
      { message: "Failed to create saved instructor level" },
      { status: 500 }
    );
  }

  return NextResponse.json({ item: data });
};

import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const getUserFromRequest = async (request: Request) => {
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

export type AdminFromRequest =
  | { admin: true; user: NonNullable<Awaited<ReturnType<typeof getUserFromRequest>>["user"]>; supabaseAdmin: NonNullable<Awaited<ReturnType<typeof getUserFromRequest>>["supabaseAdmin"]> }
  | { admin: false; errorResponse: Response };

export const getAdminFromRequest = async (request: Request): Promise<AdminFromRequest> => {
  const { user, supabaseAdmin, errorResponse } = await getUserFromRequest(request);
  if (errorResponse || !user || !supabaseAdmin) {
    return { admin: false, errorResponse: errorResponse ?? new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } }) };
  }
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (error || !profile?.is_admin) {
    return { admin: false, errorResponse: new Response(JSON.stringify({ message: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } }) };
  }
  return { admin: true, user, supabaseAdmin };
};

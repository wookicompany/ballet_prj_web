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

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  const body = await request.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const addressBase =
    typeof body?.address_base === "string" ? body.address_base.trim() : "";
  const addressDetail =
    typeof body?.address_detail === "string" ? body.address_detail.trim() : "";

  if (!id || !name) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  const { data, error } = await auth.supabaseAdmin
    .from("saved_locations")
    .update({
      name,
      address_base: addressBase || null,
      address_detail: addressDetail || null,
    })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id, name, address_base, address_detail, created_at")
    .single();

  if (error || !data) {
    console.error("Failed to update saved location", error);
    return NextResponse.json(
      { message: "Failed to update saved location" },
      { status: 500 }
    );
  }

  return NextResponse.json({ item: data });
};

export const DELETE = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  if (!id) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  const { error } = await auth.supabaseAdmin
    .from("saved_locations")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) {
    console.error("Failed to delete saved location", error);
    return NextResponse.json(
      { message: "Failed to delete saved location" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};

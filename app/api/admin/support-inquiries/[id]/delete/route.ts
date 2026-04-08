import { NextResponse } from "next/server";

import { getAdminFromRequest } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export const DELETE = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) {
    return result.errorResponse;
  }

  const { id } = await params;

  const { data: inquiry, error: fetchError } = await result.supabaseAdmin
    .from("support_inquiries")
    .select("id, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("admin support inquiry delete fetch", fetchError);
    return NextResponse.json({ message: "Failed to load support inquiry" }, { status: 500 });
  }

  if (!inquiry || inquiry.deleted_at) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const { error: updateError } = await result.supabaseAdmin
    .from("support_inquiries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    console.error("admin support inquiry delete", updateError);
    return NextResponse.json({ message: "Failed to delete support inquiry" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
};

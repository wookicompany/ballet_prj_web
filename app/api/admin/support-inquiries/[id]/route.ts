import { NextResponse } from "next/server";

import { getAdminFromRequest } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) {
    return result.errorResponse;
  }

  const { id } = await params;

  const { data: inquiry, error } = await result.supabaseAdmin
    .from("support_inquiries")
    .select("id, user_id, email, nickname, title, content, created_at")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("admin support inquiry get", error);
    return NextResponse.json(
      { message: "Failed to load support inquiry" },
      { status: 500 }
    );
  }

  if (!inquiry) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    inquiry: {
      id: inquiry.id,
      user_id: inquiry.user_id,
      email: inquiry.email,
      nickname: inquiry.nickname,
      title: inquiry.title,
      content: inquiry.content,
      created_at: inquiry.created_at,
    },
  });
};

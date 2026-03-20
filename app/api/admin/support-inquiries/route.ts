import { NextResponse } from "next/server";

import { getAdminFromRequest } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const GET = async (request: Request) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) {
    return result.errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Number(searchParams.get("offset")) || 0;
  const q = searchParams.get("q")?.trim() || "";

  let query = result.supabaseAdmin
    .from("support_inquiries")
    .select("id, user_id, email, nickname, title, content, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (q) query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`);

  const { data: inquiries, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    console.error("admin support inquiries list", error);
    return NextResponse.json(
      { message: "Failed to list support inquiries" },
      { status: 500 }
    );
  }

  let countQuery = result.supabaseAdmin
    .from("support_inquiries")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  if (q) countQuery = countQuery.or(`title.ilike.%${q}%,content.ilike.%${q}%`);
  const { count } = await countQuery;

  return NextResponse.json({
    inquiries: inquiries ?? [],
    total: count ?? 0,
    limit,
    offset,
  });
};

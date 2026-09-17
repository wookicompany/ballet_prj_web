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
    .from("notices")
    .select("id, title, is_published, published_at, created_at")
    .order("created_at", { ascending: false });
  if (q) query = query.ilike("title", `%${q}%`);

  let countQuery = result.supabaseAdmin.from("notices").select("id", { count: "exact", head: true });
  if (q) countQuery = countQuery.ilike("title", `%${q}%`);

  const [{ data: rows, error }, { count }] = await Promise.all([
    query.range(offset, offset + limit - 1),
    countQuery,
  ]);

  if (error) {
    console.error("admin notices list", error);
    return NextResponse.json({ message: "Failed to list notices" }, { status: 500 });
  }

  // 읽은 수는 현재 페이지의 공지 id만 모아 한 번에 센다(행마다 조회하면 N+1이 된다).
  const noticeIds = (rows ?? []).map((n) => n.id);
  const readCountMap: Record<string, number> = {};
  if (noticeIds.length > 0) {
    const { data: reads, error: readsError } = await result.supabaseAdmin
      .from("notice_reads")
      .select("notice_id")
      .in("notice_id", noticeIds);
    if (readsError) {
      // 읽은 수를 못 가져와도 목록 자체는 보여준다 — 0으로 표시된다.
      console.error("admin notices read counts", readsError);
    }
    for (const row of reads ?? []) {
      readCountMap[row.notice_id] = (readCountMap[row.notice_id] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    notices: (rows ?? []).map((n) => ({
      ...n,
      read_count: readCountMap[n.id] ?? 0,
    })),
    total: count ?? 0,
    limit,
    offset,
  });
};

export const POST = async (request: Request) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) {
    return result.errorResponse;
  }

  let body: { title?: string; content?: string; is_published?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const title = body.title?.trim();
  const content = body.content?.trim();
  if (!title || !content) {
    return NextResponse.json({ message: "title and content are required" }, { status: 400 });
  }

  const is_published = body.is_published === true;
  const insert: { title: string; content: string; is_published: boolean; published_at?: string } = {
    title,
    content,
    is_published,
  };
  if (is_published) {
    insert.published_at = new Date().toISOString();
  }

  const { data: notice, error } = await result.supabaseAdmin
    .from("notices")
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error("admin notices create", error);
    return NextResponse.json({ message: "Failed to create notice" }, { status: 500 });
  }

  return NextResponse.json({ notice });
};

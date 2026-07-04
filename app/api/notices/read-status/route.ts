import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

export const GET = async (request: Request) => {
  const { user, supabaseAdmin, errorResponse } = await getUserFromRequest(request);
  if (errorResponse || !user || !supabaseAdmin) {
    return errorResponse ?? NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data: publishedNotices, error: noticesError } = await supabaseAdmin
    .from("notices")
    .select("id")
    .eq("is_published", true);

  if (noticesError) {
    console.error("Failed to load published notices", noticesError);
    return NextResponse.json({ message: "Failed to load notice read status" }, { status: 500 });
  }

  const noticeIds = (publishedNotices ?? []).map((notice) => notice.id);
  if (noticeIds.length === 0) {
    return NextResponse.json({ has_unread: false, read_notice_ids: [], unread_notice_ids: [] });
  }

  const { data: readRows, error: readsError } = await supabaseAdmin
    .from("notice_reads")
    .select("notice_id")
    .eq("user_id", user.id)
    .in("notice_id", noticeIds);

  if (readsError) {
    console.error("Failed to load notice reads", readsError);
    return NextResponse.json({ message: "Failed to load notice read status" }, { status: 500 });
  }

  const readNoticeIds = Array.from(
    new Set((readRows ?? []).map((row) => row.notice_id).filter(Boolean))
  );
  const readSet = new Set(readNoticeIds);
  const unreadNoticeIds = noticeIds.filter((id) => !readSet.has(id));

  return NextResponse.json({
    has_unread: unreadNoticeIds.length > 0,
    read_notice_ids: readNoticeIds,
    unread_notice_ids: unreadNoticeIds,
  });
};

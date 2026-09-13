import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

const MAX_IMAGES = 3;
const BUCKET = "record-media";
const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`;

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  const { data: ticket, error: ticketError } = await auth.supabaseAdmin
    .from("performance_tickets")
    .select("id, user_id, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (ticketError) {
    console.error("Failed to load ticket", ticketError);
    return NextResponse.json({ message: "Failed to load ticket" }, { status: 500 });
  }
  if (!ticket || ticket.deleted_at) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (ticket.user_id !== auth.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const urls = Array.isArray(body?.urls) ? body.urls : [];
  const cleanedUrls = urls
    .filter((url: unknown): url is string => typeof url === "string" && url.trim().length > 0)
    .map((url: string) => url.trim());

  if (cleanedUrls.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { data: existingRows, error: existingError } = await auth.supabaseAdmin
    .from("performance_ticket_images")
    .select("url")
    .eq("ticket_id", id)
    .is("deleted_at", null);

  if (existingError) {
    console.error("Failed to load existing ticket images", existingError);
    return NextResponse.json({ message: "Failed to load images" }, { status: 500 });
  }

  // 멱등성: 이미 있는 url은 다시 넣지 않는다. WKWebView에서 서버는 삽입을 마쳤는데 응답만
  // 유실돼 클라가 같은 url로 재시도하는 경우 중복 행이 생기는 것을 막는다.
  const existingUrls = new Set((existingRows ?? []).map((row) => row.url));
  const newUrls = cleanedUrls.filter((url: string) => !existingUrls.has(url));
  if (newUrls.length === 0) {
    return NextResponse.json({ ok: true });
  }

  // 서버 측 장수 제한 — 기존 리뷰 이미지 API엔 이 검증이 없어(기존 구멍) curl로 4번째 url을
  // 직접 POST하면 제한을 우회할 수 있다. 클라이언트 MAX_IMAGES는 UX 가드일 뿐이므로
  // 티켓 API에는 반드시 둔다.
  if (existingUrls.size + newUrls.length > MAX_IMAGES) {
    return NextResponse.json(
      { message: `이미지는 최대 ${MAX_IMAGES}장까지 첨부할 수 있어요.` },
      { status: 400 }
    );
  }

  const { error: insertError } = await auth.supabaseAdmin
    .from("performance_ticket_images")
    .insert(
      newUrls.map((url: string) => ({
        ticket_id: id,
        user_id: auth.user.id,
        url,
      }))
    );

  if (insertError) {
    console.error("Failed to create ticket images", insertError);
    return NextResponse.json({ message: "Failed to create images" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
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

  const { data: ticket, error: ticketError } = await auth.supabaseAdmin
    .from("performance_tickets")
    .select("id, user_id, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (ticketError) {
    console.error("Failed to load ticket", ticketError);
    return NextResponse.json({ message: "Failed to load ticket" }, { status: 500 });
  }
  if (!ticket || ticket.deleted_at) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (ticket.user_id !== auth.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const imageIds = Array.isArray(body?.imageIds) ? body.imageIds : [];
  const cleanedIds = imageIds.filter(
    (value: unknown): value is string => typeof value === "string"
  );

  if (cleanedIds.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { data: rows, error: rowsError } = await auth.supabaseAdmin
    .from("performance_ticket_images")
    .select("id, user_id, ticket_id, url")
    .in("id", cleanedIds);

  if (rowsError) {
    console.error("Failed to load ticket images", rowsError);
    return NextResponse.json({ message: "Failed to load images" }, { status: 500 });
  }

  // 403은 "타인 소유"일 때만 낸다. 조회되지 않은 id는 이미 지워진 것으로 본다 —
  // 삭제가 하드 삭제라, 서버는 성공했는데 응답만 유실된 경우(WKWebView) 클라이언트가
  // 같은 id로 재시도하면 행이 없어 403이 반복되고, 그 세션에서는 이후 업로드·리뷰
  // 단계까지 도달하지 못해 저장 자체가 영구히 막힌다.
  const unauthorized = (rows ?? []).some(
    (row) => row.user_id !== auth.user.id || row.ticket_id !== id
  );
  if (unauthorized) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  if ((rows ?? []).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error: deleteError } = await auth.supabaseAdmin
    .from("performance_ticket_images")
    .delete()
    .in("id", (rows ?? []).map((row) => row.id));

  if (deleteError) {
    console.error("Failed to delete ticket images", deleteError);
    return NextResponse.json({ message: "Failed to delete images" }, { status: 500 });
  }

  // 스토리지 오브젝트도 정리한다. 여기서 실패해도 DB 행은 이미 지워졌으므로 화면상으로는
  // 사라진 상태다 — 고아 파일만 남으므로 로그만 남기고 성공으로 응답한다(리뷰 이미지와 동일).
  const storagePaths = (rows ?? [])
    .map((row) => row.url.split(PUBLIC_PREFIX)[1])
    .filter(Boolean);

  if (storagePaths.length > 0) {
    const { error: storageError } = await auth.supabaseAdmin.storage
      .from(BUCKET)
      .remove(storagePaths);
    if (storageError) {
      console.error("Failed to delete storage objects", storageError);
    }
  }

  return NextResponse.json({ ok: true });
};

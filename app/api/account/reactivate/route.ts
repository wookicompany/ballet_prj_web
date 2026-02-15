import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

const removeSoftDeletedAt = (metadata: Record<string, unknown>) => {
  const next = { ...metadata };
  delete next.soft_deleted_at;
  return next;
};

export const POST = async (request: Request) => {
  const { user, supabaseAdmin, errorResponse } = await getUserFromRequest(request);
  if (errorResponse || !user || !supabaseAdmin) {
    return (
      errorResponse ?? NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    );
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const softDeletedAt = metadata.soft_deleted_at;
  const isSoftDeleted =
    typeof softDeletedAt === "string" && softDeletedAt.trim().length > 0;

  if (!isSoftDeleted) {
    return NextResponse.json({ ok: true, reactivated: false });
  }

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({ deleted_at: null })
    .eq("id", user.id)
    .not("deleted_at", "is", null);

  if (profileError) {
    console.error("Failed to restore soft-deleted profile", profileError);
    return NextResponse.json(
      { message: "계정 재활성화 처리 중 오류가 발생했어요." },
      { status: 500 }
    );
  }

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
    user.id,
    {
      ban_duration: "none",
      user_metadata: removeSoftDeletedAt(metadata),
    }
  );

  if (authError) {
    console.error("Failed to clear soft_deleted_at metadata", authError);
    return NextResponse.json(
      { message: "계정 재활성화 처리 중 오류가 발생했어요." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, reactivated: true });
};

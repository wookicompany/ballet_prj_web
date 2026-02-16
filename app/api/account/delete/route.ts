import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";
import { getKakaoProviderUserId, getOAuthProvider } from "@/lib/oauthProvider";

const USER_SOFT_DELETE_TARGETS = [
  { table: "records", userColumn: "user_id" },
  { table: "record_media", userColumn: "user_id" },
  { table: "performance_reviews", userColumn: "user_id" },
  { table: "performance_review_comments", userColumn: "user_id" },
  { table: "performance_review_likes", userColumn: "user_id" },
  { table: "performance_review_comment_likes", userColumn: "user_id" },
  { table: "performance_review_images", userColumn: "user_id" },
  { table: "performance_review_reports", userColumn: "reporter_user_id" },
  {
    table: "performance_review_comment_reports",
    userColumn: "reporter_user_id",
  },
  { table: "saved_locations", userColumn: "user_id" },
  { table: "saved_instructor_levels", userColumn: "user_id" },
  { table: "saved_center_orders", userColumn: "user_id" },
  { table: "saved_bar_orders", userColumn: "user_id" },
  { table: "support_inquiries", userColumn: "user_id" },
  { table: "user_consents", userColumn: "user_id" },
] as const;

const tryKakaoUnlink = async ({
  adminKey,
  providerUserId,
}: {
  adminKey: string;
  providerUserId: string;
}) => {
  const body = new URLSearchParams({
    target_id_type: "user_id",
    target_id: providerUserId,
  });

  const response = await fetch("https://kapi.kakao.com/v1/user/unlink", {
    method: "POST",
    headers: {
      Authorization: `KakaoAK ${adminKey}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: body.toString(),
  });

  return response.ok;
};

export const POST = async (request: Request) => {
  const { user, supabaseAdmin, errorResponse } = await getUserFromRequest(request);
  if (errorResponse || !user || !supabaseAdmin) {
    return (
      errorResponse ?? NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    );
  }

  // 현재 정책: Kakao만 unlink를 수행하고 Apple revoke는 추후 단계로 유예한다.
  const provider = getOAuthProvider(user);
  const nowIso = new Date().toISOString();

  if (provider === "kakao") {
    const kakaoAdminKey = process.env.KAKAO_ADMIN_KEY ?? "";
    const providerUserId = getKakaoProviderUserId(user);

    if (kakaoAdminKey && providerUserId) {
      try {
        await tryKakaoUnlink({ adminKey: kakaoAdminKey, providerUserId });
      } catch {
        // B policy: continue service deletion even if unlink fails.
      }
    }
  }

  for (const { table, userColumn } of USER_SOFT_DELETE_TARGETS) {
    const { error } = await supabaseAdmin
      .from(table)
      .update({ deleted_at: nowIso })
      .eq(userColumn, user.id)
      .is("deleted_at", null);

    if (error) {
      console.error(`Failed to soft delete rows from ${table}`, error);
      return NextResponse.json(
        { message: "회원탈퇴 처리 중 오류가 발생했어요." },
        { status: 500 }
      );
    }
  }

  const { error: profileSoftDeleteError } = await supabaseAdmin
    .from("profiles")
    .update({
      deleted_at: nowIso,
      nickname: null,
      avatar_url: null,
      fcm_token: null,
    })
    .eq("id", user.id)
    .is("deleted_at", null);

  if (profileSoftDeleteError) {
    console.error("Failed to soft delete profile", profileSoftDeleteError);
    return NextResponse.json(
      { message: "회원탈퇴 처리 중 오류가 발생했어요." },
      { status: 500 }
    );
  }

  const { error: markDeletedError } = await supabaseAdmin.auth.admin.updateUserById(
    user.id,
    {
      user_metadata: {
        ...user.user_metadata,
        soft_deleted_at: nowIso,
      },
    }
  );

  if (markDeletedError) {
    console.error("Failed to mark auth user soft-deleted", markDeletedError);
    return NextResponse.json(
      { message: "회원탈퇴 처리 중 오류가 발생했어요." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};

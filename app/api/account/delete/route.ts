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

const tryAppleRevoke = async ({
  clientId,
  clientSecret,
  refreshToken,
}: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}) => {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    token: refreshToken,
    token_type_hint: "refresh_token",
  });

  const response = await fetch("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
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
  const requestBody = await request.json().catch(() => null);
  const refreshToken =
    requestBody &&
    typeof requestBody === "object" &&
    "refresh_token" in requestBody &&
    typeof requestBody.refresh_token === "string"
      ? requestBody.refresh_token.trim()
      : "";

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

  if (provider === "apple") {
    const appleClientId = process.env.APPLE_CLIENT_ID ?? "";
    const appleClientSecret = process.env.APPLE_CLIENT_SECRET ?? "";

    if (!appleClientId || !appleClientSecret || !refreshToken) {
      console.error("Apple revoke skipped due to missing config or refresh token", {
        hasClientId: Boolean(appleClientId),
        hasClientSecret: Boolean(appleClientSecret),
        hasRefreshToken: Boolean(refreshToken),
      });
    } else {
      try {
        const revoked = await tryAppleRevoke({
          clientId: appleClientId,
          clientSecret: appleClientSecret,
          refreshToken,
        });
        if (!revoked) {
          console.error("Apple revoke failed", { userId: user.id });
        }
      } catch (error) {
        console.error("Apple revoke failed with exception", {
          userId: user.id,
          error,
        });
      }
    }
  }

  // Phase 1: 14개 테이블 + profiles 15개 병렬 soft-delete
  const softDeleteResults = await Promise.all([
    ...USER_SOFT_DELETE_TARGETS.map(({ table, userColumn }) =>
      supabaseAdmin
        .from(table)
        .update({ deleted_at: nowIso })
        .eq(userColumn, user.id)
        .is("deleted_at", null)
    ),
    supabaseAdmin
      .from("profiles")
      .update({
        deleted_at: nowIso,
        nickname: null,
        avatar_url: null,
        ballet_started_at: null,
        expo_push_token: null,
      })
      .eq("id", user.id)
      .is("deleted_at", null),
  ]);

  const failedResult = softDeleteResults.find((r) => r.error);
  if (failedResult) {
    console.error("Failed to soft delete rows", failedResult.error);
    return NextResponse.json(
      { message: "회원탈퇴 처리 중 오류가 발생했어요." },
      { status: 500 }
    );
  }

  // Phase 2: auth user 메타데이터 업데이트
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

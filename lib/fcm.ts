/**
 * FCM 푸시 발송 유틸. 마이발레 Vercel API에서 알림 배너용.
 * @see docs/rn_webview_integration.md, docs/rn_webview_integration_plan.md
 *
 * 환경 변수 FIREBASE_SERVICE_ACCOUNT_KEY 에 서비스 계정 JSON 문자열이 있어야 발송됨.
 * 없으면 no-op (에러 없이 스킵).
 */

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type FCMPayload = {
  title: string;
  body: string;
  link?: string;
};

let firebaseAdmin: typeof import("firebase-admin") | null = null;

function getFirebaseAdmin(): typeof import("firebase-admin") | null {
  if (firebaseAdmin !== null) return firebaseAdmin;
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key || typeof key !== "string" || key.trim() === "") return null;
  try {
    const admin = require("firebase-admin");
    if (!admin.apps?.length) {
      const cred = JSON.parse(key) as {
        client_email?: string;
        private_key?: string;
        project_id?: string;
      };
      admin.initializeApp({ credential: admin.credential.cert(cred) });
    }
    firebaseAdmin = admin;
    return admin;
  } catch {
    return null;
  }
}

/**
 * 특정 사용자에게 FCM 푸시 발송.
 * profiles.fcm_token 이 없거나 FCM 미설정 시 no-op.
 * 실패 시 로그만 남기고 예외 전파하지 않음 (호출 측 응답에 영향 없도록).
 */
export async function sendFCMToUser(
  userId: string,
  payload: FCMPayload
): Promise<void> {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) return;

    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("fcm_token")
      .eq("id", userId)
      .maybeSingle();

    const token = profile?.fcm_token;
    if (!token || typeof token !== "string" || token.trim() === "") return;

    const messaging = admin.messaging();
    await messaging.send({
      token,
      notification: { title: payload.title, body: payload.body },
      data: payload.link ? { link: payload.link } : undefined,
    });
  } catch (err) {
    console.error("[FCM] sendFCMToUser failed", userId, err);
  }
}

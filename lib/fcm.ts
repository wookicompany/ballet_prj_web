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
  body?: string;
  link?: string;
};

let firebaseAdmin: typeof import("firebase-admin") | null = null;
let firebaseAdminLoader: Promise<typeof import("firebase-admin") | null> | null =
  null;

async function getFirebaseAdmin(): Promise<typeof import("firebase-admin") | null> {
  if (firebaseAdmin !== null) return firebaseAdmin;
  if (firebaseAdminLoader) return firebaseAdminLoader;
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key || typeof key !== "string" || key.trim() === "") return null;
  firebaseAdminLoader = (async () => {
    try {
      const adminModule = await import("firebase-admin");
      const admin = (adminModule.default ?? adminModule) as typeof import("firebase-admin");
      if (!admin.apps?.length) {
        const parsed = JSON.parse(key) as Record<string, unknown>;
        const clientEmail =
          typeof parsed.client_email === "string" ? parsed.client_email : "";
        const privateKeyRaw =
          typeof parsed.private_key === "string" ? parsed.private_key : "";
        const projectId =
          typeof parsed.project_id === "string" ? parsed.project_id : "";

        if (!clientEmail || !privateKeyRaw || !projectId) {
          return null;
        }

        const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
        admin.initializeApp({
          credential: admin.credential.cert({
            clientEmail,
            privateKey,
            projectId,
          }),
        });
      }
      firebaseAdmin = admin;
      return admin;
    } catch {
      return null;
    }
  })();
  return firebaseAdminLoader;
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
    const admin = await getFirebaseAdmin();
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
    const notification: { title: string; body?: string } = {
      title: payload.title,
    };
    if (payload.body && payload.body.trim() !== "") {
      notification.body = payload.body;
    }
    await messaging.send({
      token,
      notification,
      data: payload.link ? { link: payload.link } : undefined,
    });
  } catch (err) {
    console.error("[FCM] sendFCMToUser failed", userId, err);
  }
}

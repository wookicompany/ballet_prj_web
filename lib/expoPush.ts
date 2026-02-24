import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type ExpoPushPayload = {
  title: string;
  body?: string;
  link: string;
};

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_TOKEN_PATTERN = /^ExponentPushToken\[[^\]]+\]$/;

const isValidExpoPushToken = (value: unknown): value is string =>
  typeof value === "string" && EXPO_TOKEN_PATTERN.test(value.trim());

export const isValidExpoPushTokenFormat = (value: unknown): boolean =>
  isValidExpoPushToken(value);

export async function sendExpoPushToUser(
  userId: string,
  payload: ExpoPushPayload
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("expo_push_token")
      .eq("id", userId)
      .maybeSingle();

    const expoPushToken = profile?.expo_push_token;
    if (!isValidExpoPushToken(expoPushToken)) return;

    const authToken = process.env.EXPO_ACCESS_TOKEN;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken && authToken.trim() !== "") {
      headers.Authorization = `Bearer ${authToken.trim()}`;
    }

    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: expoPushToken.trim(),
        title: payload.title,
        body: payload.body,
        data: { link: payload.link },
        sound: "default",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[EXPO_PUSH] send failed", {
        userId,
        status: response.status,
        response: text,
      });
    }
  } catch (err) {
    console.error("[EXPO_PUSH] send failed with exception", { userId, err });
  }
}

import type { User } from "@supabase/supabase-js";

export type OAuthProvider = "kakao" | "apple" | "google" | "unknown";

export const getOAuthProvider = (user: User | null): OAuthProvider => {
  if (!user) return "unknown";
  const provider = user.app_metadata?.provider;
  if (provider === "kakao") return "kakao";
  if (provider === "apple") return "apple";
  if (provider === "google") return "google";
  return "unknown";
};

export const getKakaoProviderUserId = (user: User | null): string | null => {
  if (!user) return null;
  const providerId = user.user_metadata?.provider_id;
  if (typeof providerId !== "string" && typeof providerId !== "number") {
    return null;
  }
  const normalized = String(providerId).trim();
  return normalized.length > 0 ? normalized : null;
};

export const buildKakaoAccountLogoutUrl = ({
  restApiKey,
  logoutRedirectUri,
  state,
}: {
  restApiKey: string;
  logoutRedirectUri: string;
  state?: string;
}) => {
  const params = new URLSearchParams({
    client_id: restApiKey,
    logout_redirect_uri: logoutRedirectUri,
  });
  if (state && state.trim()) {
    params.set("state", state.trim());
  }
  return `https://kauth.kakao.com/oauth/logout?${params.toString()}`;
};

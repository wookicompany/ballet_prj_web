/**
 * RN WebView 연동용 유틸.
 * @see docs/rn_webview_integration.md, docs/rn_webview_integration_plan.md
 */

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

/** RN WebView 환경인지 여부 */
export function isInReactNativeWebView(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.ReactNativeWebView?.postMessage === "function";
}

/** WebView일 때만 앱에 햅틱 요청 전송. 브라우저에서는 no-op */
export function sendHapticToApp(): void {
  if (typeof window === "undefined") return;
  window.ReactNativeWebView?.postMessage(
    JSON.stringify({ type: "haptic" })
  );
}

/** WebView일 때만 앱에 auth_token 전달. 브라우저에서는 no-op */
export function sendAuthTokenToApp(accessToken: string): void {
  if (typeof window === "undefined") return;
  const trimmedToken = accessToken.trim();
  if (!trimmedToken) return;
  window.ReactNativeWebView?.postMessage(
    JSON.stringify({ type: "auth_token", access_token: trimmedToken })
  );
}

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

/** WebView일 때만 앱에 로그아웃 이벤트 전달. 브라우저에서는 no-op */
export function sendLogoutToApp(): void {
  if (typeof window === "undefined") return;
  window.ReactNativeWebView?.postMessage(
    JSON.stringify({ type: "logout", version: 1 })
  );
}

/** WebView일 때만 앱에 회원탈퇴 이벤트 전달. 브라우저에서는 no-op */
export function sendAccountDeletedToApp(): void {
  if (typeof window === "undefined") return;
  window.ReactNativeWebView?.postMessage(
    JSON.stringify({ type: "account_deleted", version: 1 })
  );
}

export const RN_ADDRESS_SELECTED_EVENT = "myballet:address-selected";

type AddressMessagePayload = {
  type?: string;
  address?: string;
  roadAddress?: string;
  jibunAddress?: string;
};

/**
 * WebView 환경에서 RN 앱에 주소 검색 UI 오픈 요청을 보낸다.
 * 전송 성공 시 true, WebView 환경이 아니면 false를 반환한다.
 */
export function requestAddressSearchFromApp(): boolean {
  if (!isInReactNativeWebView()) return false;
  window.ReactNativeWebView?.postMessage(
    JSON.stringify({ type: "open_address_search" })
  );
  return true;
}

/**
 * RN -> Web 브릿지 메시지에서 선택된 주소를 추출한다.
 * 지원 형식:
 * - { type: "address_selected", address: "..." }
 * - { type: "address_search_result", roadAddress?: "...", jibunAddress?: "..." }
 * - CustomEvent.detail에 동일 payload 전달
 */
export function resolveAddressFromBridgeMessage(raw: unknown): string | null {
  const payload = normalizeAddressPayload(raw);
  if (!payload) return null;

  const type = payload.type?.trim();
  if (
    type &&
    type !== "address_selected" &&
    type !== "address_search_result" &&
    type !== "kakao_postcode_selected"
  ) {
    return null;
  }

  const address =
    payload.address?.trim() ||
    payload.roadAddress?.trim() ||
    payload.jibunAddress?.trim() ||
    "";

  return address || null;
}

function normalizeAddressPayload(raw: unknown): AddressMessagePayload | null {
  if (raw == null) return null;

  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as AddressMessagePayload)
        : null;
    } catch {
      return null;
    }
  }

  if (typeof raw === "object") {
    return raw as AddressMessagePayload;
  }

  return null;
}

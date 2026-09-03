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

/**
 * 진동(햅틱) 전역 온오프 게이트. 순수 메모리 변수만 사용 — 스토리지 접근 금지.
 * 앱 로드 시 AuthProvider가 서버(profiles.haptic_enabled) 값을 주입한다.
 */
let hapticEnabled = true;

/** 진동 전역 게이트 값 설정. false면 sendHapticToApp()이 즉시 no-op */
export function setHapticEnabled(v: boolean): void {
  hapticEnabled = v;
}

/** 진동 전역 게이트 현재 값 조회 */
export function getHapticEnabled(): boolean {
  return hapticEnabled;
}

/** WebView일 때만 앱에 햅틱 요청 전송. 브라우저에서는 no-op. 게이트 OFF면 no-op */
export function sendHapticToApp(): void {
  if (typeof window === "undefined") return;
  if (!hapticEnabled) return;
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

/** WebView일 때만 앱에 URL 열기 요청 전달. 브라우저에서는 false 반환 */
export function openUrlInApp(url: string, title?: string): boolean {
  if (!isInReactNativeWebView()) return false;
  window.ReactNativeWebView?.postMessage(
    JSON.stringify({ type: "open_url", url, title })
  );
  return true;
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

export const RN_PLATFORM_INFO_EVENT = "myballet:platform-info";
export const RN_HEALTH_SYNC_RESULT_EVENT = "myballet:health-sync-result";

type AddressMessagePayload = {
  type?: string;
  address?: string;
  roadAddress?: string;
  jibunAddress?: string;
};

export type AppPlatform = "ios" | "android";
export type HealthProvider = "healthkit" | "health_connect" | "none";

type PlatformInfoPayload = {
  type?: string;
  version?: number;
  platform?: string;
  health_provider?: string;
};

export type HealthSyncErrorCode =
  | "NO_PERMISSION"
  | "NO_DATA"
  | "TIMEOUT"
  | "QUERY_FAILED";

type HealthSyncRequestPayload = {
  type: "health_sync_request";
  version: 1;
  request_id: string;
  date: string;
  activity: "barre";
};

type HealthWorkoutPayload = {
  activity?: string | null;
  activity_label?: string | null;
  source_name?: string | null;
  device_name?: string | null;
  active_energy_kcal?: number | null;
  total_energy_kcal?: number | null;
  avg_bpm?: number | null;
  max_bpm?: number | null;
};

type HealthSyncResultSuccessPayload = {
  type?: string;
  version?: number;
  request_id?: string;
  status?: "success";
  workout?: HealthWorkoutPayload;
};

type HealthSyncResultErrorPayload = {
  type?: string;
  version?: number;
  request_id?: string;
  status?: "error";
  code?: string;
  message?: string;
};

export type HealthSyncResult =
  | {
      requestId: string;
      status: "success";
      workout: {
        activity: "barre";
        activityLabel: string | null;
        sourceName: string | null;
        deviceName: string | null;
        activeEnergyKcal: number | null;
        totalEnergyKcal: number | null;
        avgBpm: number | null;
        maxBpm: number | null;
      };
    }
  | {
      requestId: string;
      status: "error";
      code: HealthSyncErrorCode;
      message: string;
    };

export function resolvePlatformInfoFromBridgeMessage(raw: unknown): {
  platform: AppPlatform;
  healthProvider: HealthProvider;
} | null {
  const payload = parseBridgePayload(raw) as PlatformInfoPayload | null;
  if (!payload) return null;
  if (payload.type !== "platform_info") return null;
  if (payload.version !== 1) return null;

  const platform = normalizePlatform(payload.platform);
  const healthProvider = normalizeHealthProvider(payload.health_provider);
  if (!platform || !healthProvider) return null;

  return {
    platform,
    healthProvider,
  };
}

export function requestHealthSyncFromApp({
  requestId,
  date,
  activity = "barre",
}: {
  requestId: string;
  date: string;
  activity?: "barre";
}): boolean {
  if (!isInReactNativeWebView()) return false;
  const trimmedRequestId = requestId.trim();
  const trimmedDate = date.trim();
  if (!trimmedRequestId || !trimmedDate) return false;

  const payload: HealthSyncRequestPayload = {
    type: "health_sync_request",
    version: 1,
    request_id: trimmedRequestId,
    date: trimmedDate,
    activity,
  };
  window.ReactNativeWebView?.postMessage(JSON.stringify(payload));
  return true;
}

export function resolveHealthSyncFromBridgeMessage(raw: unknown): HealthSyncResult | null {
  const payload = parseBridgePayload(raw) as
    | HealthSyncResultSuccessPayload
    | HealthSyncResultErrorPayload
    | null;
  if (!payload || payload.type !== "health_sync_result" || payload.version !== 1) {
    return null;
  }

  const requestId = payload.request_id?.trim();
  if (!requestId) return null;

  if (payload.status === "success") {
    const workout = payload.workout;
    if (!workout || workout.activity !== "barre") return null;
    return {
      requestId,
      status: "success",
      workout: {
        activity: "barre",
        activityLabel: normalizeOptionalString(workout.activity_label),
        sourceName: normalizeOptionalString(workout.source_name),
        deviceName: normalizeOptionalString(workout.device_name),
        activeEnergyKcal: normalizeOptionalNumber(workout.active_energy_kcal),
        totalEnergyKcal: normalizeOptionalNumber(workout.total_energy_kcal),
        avgBpm: normalizeOptionalNumber(workout.avg_bpm),
        maxBpm: normalizeOptionalNumber(workout.max_bpm),
      },
    };
  }

  if (payload.status === "error") {
    if (
      payload.code !== "NO_PERMISSION" &&
      payload.code !== "NO_DATA" &&
      payload.code !== "TIMEOUT" &&
      payload.code !== "QUERY_FAILED"
    ) {
      return null;
    }
    return {
      requestId,
      status: "error",
      code: payload.code,
      message: typeof payload.message === "string" ? payload.message : "",
    };
  }

  return null;
}

export function resolveHealthSyncMessage(raw: unknown): HealthSyncResult | null {
  return resolveHealthSyncFromBridgeMessage(raw);
}

function parseBridgePayload(raw: unknown): AddressMessagePayload | null {
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

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function normalizePlatform(value: unknown): AppPlatform | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "ios") return "ios";
  if (normalized === "android") return "android";
  return null;
}

function normalizeHealthProvider(value: unknown): HealthProvider | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "healthkit") return "healthkit";
  if (normalized === "health_connect") return "health_connect";
  if (normalized === "none") return "none";
  return null;
}

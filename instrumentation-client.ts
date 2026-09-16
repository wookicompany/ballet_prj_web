// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.05,
  sendDefaultPii: false,
  // 화면이 전환되면 날아가던 요청이 끊기고 AbortError가 난다. WKWebView에서 특히 잦다.
  // 우리 코드의 fetch는 전부 try/catch나 .catch()로 막아 뒀고(components/ads/AdBanner.tsx 등),
  // 여기 올라오는 건 gtag 같은 서드파티가 보낸 요청이라 catch를 붙일 수가 없다.
  // 기능에 영향이 없는데 샘플링 5%로도 잡힐 만큼 잦아, 진짜 에러가 묻히지 않게 걸러낸다.
  ignoreErrors: ["AbortError", "The operation was aborted"],
  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.Authorization;
    }
    // 취소된 요청(DOMException ABORT_ERR, code 20)을 한 번 더 확인한다. 브라우저마다
    // 모양이 달라 세 경우를 모두 본다 — 타입이 AbortError로 잡히는 경우, Error로 감싸여
    // 메시지 앞에 "AbortError:"가 붙는 경우(이번 이슈), 그리고 WebKit 문구
    // "The operation was aborted"만 오는 경우.
    const isAbort = event.exception?.values?.some(
      (value) =>
        value.type === "AbortError" ||
        value.value?.includes("AbortError") ||
        value.value?.includes("The operation was aborted")
    );
    if (isAbort) return null;
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

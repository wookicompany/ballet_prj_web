// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.05,
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.Authorization;
    }
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

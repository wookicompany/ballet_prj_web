// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
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

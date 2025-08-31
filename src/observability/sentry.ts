// src/observability/sentry.ts
// Lightweight helpers for capturing tool-level errors where desired.
// Using @sentry/cloudflare wrapper in index.ts already instruments the Worker.

import * as Sentry from "@sentry/cloudflare";

export function captureError(e: unknown, context?: Record<string, unknown>) {
  try {
    Sentry.captureException(e, (scope) => {
      if (context) {scope.setContext("tool", context);}
      return scope;
    });
  } catch {
    // no-op
  }
}

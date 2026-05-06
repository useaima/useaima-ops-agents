import * as Sentry from "@sentry/cloudflare";

export class SentryConnector {
  /**
   * Captures an exception and sends it to Sentry.
   */
  captureException(env: any, error: any, context?: Record<string, any>): void {
    if (!env.SENTRY_DSN) {
      console.warn("SENTRY_DSN not configured. Skipping Sentry logging.");
      return;
    }
    
    // In a full Cloudflare Worker Sentry integration, the Sentry client
    // is usually initialized at the handler level.
    // We assume Sentry.withScope is available via Toucan or @sentry/cloudflare.
    Sentry.captureException(error, {
      extra: context
    });
  }
}

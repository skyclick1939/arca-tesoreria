// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://48f7a4d0f889cbcde0035502e99a9369@o4510290288967680.ingest.us.sentry.io/4510290303647744',

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Filter out errors we don't want to track
  beforeSend(event, hint) {
    // Don't send errors that are less than 500 level
    const error = hint.originalException;

    // Ignore common browser errors
    if (error && typeof error === 'object' && 'message' in error) {
      const message = String(error.message);

      // Ignore ResizeObserver loop errors (benign browser warnings)
      if (message.includes('ResizeObserver')) {
        return null;
      }

      // Ignore cancelled fetch requests
      if (message.includes('cancelled') || message.includes('aborted')) {
        return null;
      }
    }

    return event;
  },
});

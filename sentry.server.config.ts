// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://48f7a4d0f889cbcde0035502e99a9369@o4510290288967680.ingest.us.sentry.io/4510290303647744',

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Filter out errors we don't want to track
  beforeSend(event, hint) {
    // Don't send errors that are less than 500 level
    const error = hint.originalException;

    // Ignore database connection timeouts (handled by React Query retry)
    if (error && typeof error === 'object' && 'message' in error) {
      const message = String(error.message);

      if (message.includes('timeout') || message.includes('ECONNREFUSED')) {
        return null;
      }
    }

    return event;
  },
});

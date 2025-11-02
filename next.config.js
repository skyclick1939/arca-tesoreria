const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: [],
  },
  // Sentry configuration
  sentry: {
    // Hide source maps from being publicly available in production
    hideSourceMaps: true,
  },
}

// Sentry webpack plugin options
const sentryWebpackPluginOptions = {
  // Additional config options for the Sentry webpack plugin. Keep in mind that
  // the following options are set automatically, and overriding them is not
  // recommended:
  //   release, url, configFile, stripPrefix, urlPrefix, include, ignore

  org: "personal-projects",
  project: "el-arca",

  // An auth token is required for uploading source maps.
  // You can get an auth token from https://sentry.io/settings/account/api/auth-tokens/
  // The token must have `project:releases` and `org:read` scopes for uploading source maps
  authToken: process.env.SENTRY_AUTH_TOKEN,

  silent: true, // Suppresses all logs
}

// Make sure adding Sentry options is the last code to run before exporting
module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions)

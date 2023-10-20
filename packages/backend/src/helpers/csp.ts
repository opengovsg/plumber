import helmet, { HelmetOptions } from 'helmet'

import appConfig from '@/config/app'

const helmetOptions: HelmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", appConfig.baseUrl],
      baseUri: ["'self'"],
      blockAllMixedContent: [],
      connectSrc: [
        "'self'",
        // For Datadog RUM
        'https://*.browser-intake-datadoghq.com',
        // Launch Darkly feature flags
        'https://*.launchdarkly.com',
        appConfig.baseUrl,
      ],
      // for google fonts
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      frameAncestors: ["'none'"],
      frameSrc: [
        "'self'",
        appConfig.isDev && 'https://*.apollographql.com',
      ].filter(Boolean),
      imgSrc: [
        "'self'",
        'https://file.go.gov.sg',
        'https://www.google-analytics.com',
        'https://www.googletagmanager.com',
        appConfig.isDev && 'https://*.apollographql.com',
        appConfig.baseUrl,
      ].filter(Boolean),
      objectSrc: ["'none'"],
      // for google fonts
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      scriptSrcAttr: ["'none'"],
      scriptSrc: [
        "'self'",
        'https://www.google-analytics.com',
        'https://www.googletagmanager.com',
        appConfig.isDev && 'https://*.apollographql.com',
        appConfig.isDev && "'unsafe-inline'",
      ].filter(Boolean),
      manifestSrc: [
        "'self'",
        !appConfig.isDev && 'https://*.apollographql.com',
      ].filter(Boolean),
      upgradeInsecureRequests: [],
    },
  },
  crossOriginOpenerPolicy: {
    // required for using window.opener
    policy: 'unsafe-none',
  },
  crossOriginResourcePolicy: {
    policy: appConfig.isDev ? 'cross-origin' : 'same-site',
  },
  crossOriginEmbedderPolicy: false,
}

export default helmet(helmetOptions)

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
        'https://browser-intake-datadoghq.com',
        'https://*.browser-intake-datadoghq.com',
        // Launch Darkly feature flags
        'https://*.launchdarkly.com',
        // For proxying datadog rum
        'https://rum-proxy.plumber.gov.sg',
        // For Lens Survey
        'https://lens.open.gov.sg',
        // For S3 bucket
        'https://plumber-uat-attachment-bucket-private-0d9400e.s3.ap-southeast-1.amazonaws.com',
        'https://plumber-staging-attachment-bucket-private-ab28487.s3.ap-southeast-1.amazonaws.com',
        'https://plumber-prod-attachment-bucket-private-beb3aa3.s3.ap-southeast-1.amazonaws.com',
        appConfig.baseUrl,
      ],
      // for google fonts
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      frameAncestors: ["'none'"],
      frameSrc: [
        "'self'",
        'https://demo.arcade.software',
        appConfig.isDev && 'https://*.apollographql.com',
      ].filter(Boolean),
      imgSrc: [
        "'self'",
        'data:',
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
      workerSrc: ['blob:', "'self'"],
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

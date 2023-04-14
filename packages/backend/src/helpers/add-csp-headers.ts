import { Application } from 'express'
import helmet from 'helmet'

import appConfig from '../config/app'

const addCspHeaders = async (app: Application) => {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'", appConfig.baseUrl],
          baseUri: ["'self'"],
          blockAllMixedContent: [],
          connectSrc: [
            "'self'",
            // For Datadog RUM
            'https://*.browser-intake-datadoghq.com',
            appConfig.baseUrl,
          ],
          // for google fonts
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          frameAncestors: ["'none'"],
          imgSrc: [
            "'self'",
            'https://file.go.gov.sg',
            'https://www.google-analytics.com',
            'https://www.googletagmanager.com',
            appConfig.baseUrl,
          ],
          objectSrc: ["'none'"],
          // for google fonts
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          scriptSrcAttr: ["'none'"],
          scriptSrc: [
            "'self'",
            'https://www.google-analytics.com',
            'https://www.googletagmanager.com',
          ],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginResourcePolicy: {
        policy: appConfig.isDev ? 'cross-origin' : 'same-site',
      },
    }),
  )
}

export default addCspHeaders

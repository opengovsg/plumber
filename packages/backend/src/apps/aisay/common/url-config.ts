import appConfig from '@/config/app'

/**
 * Config for AISAY
 * We only use different URLs for prod, all other environments will use
 * AISAY's staging environment
 */
export const aisayUrlConfig = appConfig.isProd
  ? {
      baseUrl: 'https://ai.ff.gov.sg',
      getTokenUrl:
        'https://aisay-prd-app.auth.ap-southeast-1.amazoncognito.com/oauth2/token',
    }
  : {
      baseUrl: 'https://stg.ai.ff.gov.sg',
      getTokenUrl:
        'https://aisay-stg-app.auth.ap-southeast-1.amazoncognito.com/oauth2/token',
    }

interface AppConfig {
  baseUrl: string
  launchDarklyClientId: string
  sgidClientId: string
  isDev: boolean
  env: string
  version: string
  lensSurveyClientKey: string
  ssoClientId: string
  ssoHostname: string
}

function getAppConfig(): AppConfig {
  // important: although import.meta.env.VITE_MODE is available, do not use
  // use it as it is not available in development mode
  const env = import.meta.env.MODE
  const version = import.meta.env.PACKAGE_VERSION
  const commonEnv = {
    env,
    version,
  }

  switch (env) {
    case 'prod':
      return {
        baseUrl: 'https://plumber.gov.sg',
        launchDarklyClientId: '64bf4b539077f112ef24e4ae',
        sgidClientId: 'PLUMBER-c24255a5',
        isDev: false,
        lensSurveyClientKey: 'cm85ca2f300053ooz4vydrmyw',
        ssoClientId: 'plumber-prod',
        ssoHostname: 'https://sso.open.gov.sg',
        ...commonEnv,
      }
    // UAT and staging differ for the lens survey client key only
    case 'uat':
      return {
        baseUrl: 'https://uat.plumber.gov.sg',
        launchDarklyClientId: '65016ca0b45b7712e6c95703',
        sgidClientId: 'PLUMBERSTAGING-776896b1',
        isDev: false,
        lensSurveyClientKey: 'cm8fp8i030008zm2tbuc07xe5',
        ssoClientId: 'plumber-uat',
        ssoHostname: 'https://sso.open.gov.sg',
        ...commonEnv,
      }
    case 'staging':
      return {
        baseUrl: 'https://staging.plumber.gov.sg',
        launchDarklyClientId: '65016ca0b45b7712e6c95703',
        sgidClientId: 'PLUMBERSTAGING-776896b1',
        isDev: false,
        lensSurveyClientKey: 'cm86psst900052orfqetz3gz5',
        ssoClientId: 'plumber-staging',
        ssoHostname: 'https://sso.open.gov.sg',
        ...commonEnv,
      }
    default:
      return {
        baseUrl: 'http://localhost:3001',
        launchDarklyClientId: '64bf4b539077f112ef24e4ad',
        sgidClientId: 'PLUMBERLOCALDEV-dc1a72f7',
        isDev: true,
        lensSurveyClientKey: 'cm8fpeah2000gzm2t572lhfti',
        ssoClientId: 'plumber-local',
        ssoHostname: 'http://localhost:5354',
        ...commonEnv,
      }
  }
}

const appConfig = getAppConfig()

export default appConfig

interface AppConfig {
  launchDarklyClientId: string
  sgidClientId: string
  isDev: boolean
  env: string
  version: string
  ssoClientId: string
  ssoHostname: string
  confettiSurveyPublishableKey: string
  confettiSurveyId: string
}

function getAppConfig(): AppConfig {
  // important: although import.meta.env.VITE_MODE is available, do not use
  // use it as it is not available in development mode
  const env = import.meta.env.MODE
  const version = import.meta.env.PACKAGE_VERSION
  const confettiSurveyPublishableKey =
    'cfti_pk_dfde134552a318551e05559024f432ba'
  const commonEnv = {
    env,
    version,
    confettiSurveyPublishableKey,
  }

  switch (env) {
    case 'prod':
      return {
        launchDarklyClientId: '64bf4b539077f112ef24e4ae',
        sgidClientId: 'PLUMBER-c24255a5',
        isDev: false,
        ssoClientId: 'plumber-prod',
        ssoHostname: 'https://sso.open.gov.sg',
        confettiSurveyId: 'n1yv6rl15ynq6wazr3x1pdjc',
        ...commonEnv,
      }
    case 'uat':
      return {
        launchDarklyClientId: '65016ca0b45b7712e6c95703',
        sgidClientId: 'PLUMBERSTAGING-776896b1',
        isDev: false,
        ssoClientId: 'plumber-uat',
        ssoHostname: 'https://sso.open.gov.sg',
        confettiSurveyId: 'i4wpjgv7x45la64coglh6h9p',
        ...commonEnv,
      }
    case 'staging':
      return {
        launchDarklyClientId: '65016ca0b45b7712e6c95703',
        sgidClientId: 'PLUMBERSTAGING-776896b1',
        isDev: false,
        ssoClientId: 'plumber-staging',
        ssoHostname: 'https://sso.open.gov.sg',
        confettiSurveyId: 'i4wpjgv7x45la64coglh6h9p',
        ...commonEnv,
      }
    default:
      return {
        launchDarklyClientId: '64bf4b539077f112ef24e4ad',
        sgidClientId: 'PLUMBERLOCALDEV-dc1a72f7',
        isDev: true,
        ssoClientId: 'plumber-local',
        ssoHostname: 'http://localhost:5354',
        confettiSurveyId: 'i4wpjgv7x45la64coglh6h9p',
        ...commonEnv,
      }
  }
}

const appConfig = getAppConfig()

export default appConfig

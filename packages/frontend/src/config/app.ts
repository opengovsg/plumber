import {
  confettiApiBaseUrl,
  confettiSurveyPublishableKey,
  posthogHost,
  posthogProjectToken,
} from '@plumber/shared'

interface AppConfig {
  launchDarklyClientId: string
  sgidClientId: string
  isDev: boolean
  env: string
  version: string
  confettiSurveyPublishableKey: string
  confettiSurveyId: string
  confettiAiBuilderSurveyId: string
  confettiApiBaseUrl: string
  posthogProjectToken: string
  posthogHost: string
}

function getAppConfig(): AppConfig {
  // important: although import.meta.env.VITE_MODE is available, do not use
  // use it as it is not available in development mode
  const env = import.meta.env.MODE
  const version = import.meta.env.PACKAGE_VERSION
  const commonEnv = {
    env,
    version,
    confettiSurveyPublishableKey,
    confettiApiBaseUrl,
    posthogProjectToken,
    posthogHost,
  }

  switch (env) {
    case 'prod':
      return {
        launchDarklyClientId: '64bf4b539077f112ef24e4ae',
        sgidClientId: 'PLUMBER-c24255a5',
        isDev: false,
        confettiSurveyId: 'n1yv6rl15ynq6wazr3x1pdjc',
        confettiAiBuilderSurveyId: 'he8paxvow3kv4lp0ozdtxw44',
        ...commonEnv,
      }
    case 'uat':
      return {
        launchDarklyClientId: '65016ca0b45b7712e6c95703',
        sgidClientId: 'PLUMBERSTAGING-776896b1',
        isDev: false,
        confettiSurveyId: 'i4wpjgv7x45la64coglh6h9p',
        confettiAiBuilderSurveyId: 'm6g5hm6803jcbgkip7hqoqim',
        ...commonEnv,
      }
    case 'staging':
      return {
        launchDarklyClientId: '65016ca0b45b7712e6c95703',
        sgidClientId: 'PLUMBERSTAGING-776896b1',
        isDev: false,
        confettiSurveyId: 'i4wpjgv7x45la64coglh6h9p',
        confettiAiBuilderSurveyId: 'm6g5hm6803jcbgkip7hqoqim',
        ...commonEnv,
      }
    default:
      return {
        launchDarklyClientId: '64bf4b539077f112ef24e4ad',
        sgidClientId: 'PLUMBERLOCALDEV-dc1a72f7',
        isDev: true,
        confettiSurveyId: 'i4wpjgv7x45la64coglh6h9p',
        confettiAiBuilderSurveyId: 'm6g5hm6803jcbgkip7hqoqim',
        ...commonEnv,
      }
  }
}

const appConfig = getAppConfig()

export default appConfig

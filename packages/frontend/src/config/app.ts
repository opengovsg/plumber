interface ConfettiSurveyIds {
  seqPipe: string
  seqRegular: string
  csat: string
}

// Shared by every non-prod environment so test responses stay out of prod data.
const TEST_SURVEY_IDS: ConfettiSurveyIds = {
  seqPipe: 'pmzg7ujg822tp40ax91kxshv',
  seqRegular: 'pmzg7ujg822tp40ax91kxshv',
  csat: 'mew4lbzeltujp8mvhsigm3e9',
}

interface AppConfig {
  launchDarklyClientId: string
  sgidClientId: string
  isDev: boolean
  env: string
  version: string
  confettiSurveyPublishableKey: string
  confettiSurveyIds: ConfettiSurveyIds
  confettiApiBaseUrl: string
  posthogProjectToken: string
  posthogHost: string
}

function getAppConfig(): AppConfig {
  // important: although import.meta.env.VITE_MODE is available, do not use
  // use it as it is not available in development mode
  const env = import.meta.env.MODE
  const version = import.meta.env.PACKAGE_VERSION
  const confettiSurveyPublishableKey =
    'cfti_pk_dfde134552a318551e05559024f432ba'
  // Routed through our own domain, since CSP only allows connecting to
  // plumber.gov.sg domains directly (see packages/backend/src/helpers/csp.ts).
  const confettiApiBaseUrl = 'https://confetti.plumber.gov.sg'
  const posthogProjectToken = 'phc_nwcM6rC7WU7CzdW9Z4zvB3dcZWFM9fn2URbqs35FFQQQ'
  const posthogHost = 'https://a.plumber.gov.sg'
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
        confettiSurveyIds: {
          seqPipe: 'qlys32hkbu5suddiqifmxl0c',
          seqRegular: 'qlys32hkbu5suddiqifmxl0c',
          csat: 'v7459ig9gdpvtjkgvtvumyg3',
        },
        ...commonEnv,
      }
    case 'uat':
      return {
        launchDarklyClientId: '65016ca0b45b7712e6c95703',
        sgidClientId: 'PLUMBERSTAGING-776896b1',
        isDev: false,
        confettiSurveyIds: TEST_SURVEY_IDS,
        ...commonEnv,
      }
    case 'staging':
      return {
        launchDarklyClientId: '65016ca0b45b7712e6c95703',
        sgidClientId: 'PLUMBERSTAGING-776896b1',
        isDev: false,
        confettiSurveyIds: TEST_SURVEY_IDS,
        ...commonEnv,
      }
    default:
      return {
        launchDarklyClientId: '64bf4b539077f112ef24e4ad',
        sgidClientId: 'PLUMBERLOCALDEV-dc1a72f7',
        isDev: true,
        confettiSurveyIds: TEST_SURVEY_IDS,
        ...commonEnv,
      }
  }
}

const appConfig = getAppConfig()

export default appConfig

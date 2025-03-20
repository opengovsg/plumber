interface AppConfig {
  launchDarklyClientId: string
  sgidClientId: string
  isDev: boolean
  env: string
  version: string
  lensSurveyClientKey: string
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
        launchDarklyClientId: '64bf4b539077f112ef24e4ae',
        sgidClientId: 'PLUMBER-c24255a5',
        isDev: false,
        lensSurveyClientKey: 'cm85ca2f300053ooz4vydrmyw',
        ...commonEnv,
      }
    // UAT and staging differ for the lens survey client key only
    case 'uat':
      return {
        launchDarklyClientId: '65016ca0b45b7712e6c95703',
        sgidClientId: 'PLUMBERSTAGING-776896b1',
        isDev: false,
        lensSurveyClientKey: 'cm8fp8i030008zm2tbuc07xe5',
        ...commonEnv,
      }
    case 'staging':
      return {
        launchDarklyClientId: '65016ca0b45b7712e6c95703',
        sgidClientId: 'PLUMBERSTAGING-776896b1',
        isDev: false,
        lensSurveyClientKey: 'cm86psst900052orfqetz3gz5',
        ...commonEnv,
      }
    default:
      return {
        launchDarklyClientId: '64bf4b539077f112ef24e4ad',
        sgidClientId: 'PLUMBERLOCALDEV-dc1a72f7',
        isDev: true,
        lensSurveyClientKey: 'cm8fpeah2000gzm2t572lhfti',
        ...commonEnv,
      }
  }
}

const appConfig = getAppConfig()

export default appConfig

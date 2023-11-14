interface AppConfig {
  launchDarklyClientId: string
  sgidClientId: string
  isDev: boolean
  env: string
  version: string
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
        ...commonEnv,
      }
    case 'uat':
    case 'staging':
      return {
        launchDarklyClientId: '65016ca0b45b7712e6c95703',
        sgidClientId: 'PLUMBERSTAGING-776896b1',
        isDev: false,

        ...commonEnv,
      }
    default:
      return {
        launchDarklyClientId: '64bf4b539077f112ef24e4ad',
        sgidClientId: 'PLUMBERLOCALDEV-dc1a72f7',
        isDev: true,
        ...commonEnv,
      }
  }
}

const appConfig = getAppConfig()

export default appConfig

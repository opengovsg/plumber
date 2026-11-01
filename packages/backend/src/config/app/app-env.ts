import './load-dev-env'

export type AppEnvConfig = {
  appEnv: string
  isProd: boolean
  isDev: boolean
}

const appEnv = process.env.APP_ENV || 'development'

const appEnvConfig: AppEnvConfig = {
  appEnv,
  isProd: appEnv === 'prod',
  isDev: appEnv === 'development',
}

export default appEnvConfig

import coreConfig, { type CoreConfig } from './core'
import dbConfig, { type DbConfig } from './db'
import appEnvConfig, { type AppEnvConfig } from './load-app-env'
import redisConfig, { type RedisConfig } from './redis'

export type AppConfig = AppEnvConfig & CoreConfig & DbConfig & RedisConfig

const appConfig: AppConfig = {
  ...appEnvConfig,
  ...coreConfig,
  ...dbConfig,
  ...redisConfig,
}

export default appConfig

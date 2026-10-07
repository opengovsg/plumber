import coreConfig, { type CoreConfig } from './core'
import dbConfig, { type DbConfig } from './db'

export type AppConfig = CoreConfig & DbConfig

const appConfig: AppConfig = {
  ...coreConfig,
  ...dbConfig,
}

export default appConfig

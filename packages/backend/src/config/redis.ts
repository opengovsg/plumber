import appConfig from './app'

type TRedisConfig = {
  host: string
  port: number
  username?: string
  password?: string
  enableReadyCheck?: boolean
  enableOfflineQueue: boolean
}

const redisConfig: TRedisConfig = {
  host: appConfig.redisHost,
  port: appConfig.redisPort,
  username: appConfig.redisUsername,
  password: appConfig.redisPassword,
  enableOfflineQueue: false,
  enableReadyCheck: true,
}

export default redisConfig

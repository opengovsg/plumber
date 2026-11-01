import './load-app-env'

export type RedisConfig = {
  redisHost: string
  redisPort: number
  redisUsername?: string
  redisPassword?: string
  redisTls: boolean
  redisClusterMode: boolean
}

const redisConfig: RedisConfig = {
  redisHost: process.env.REDIS_HOST || '127.0.0.1',
  redisPort: parseInt(process.env.REDIS_PORT || '6379'),
  redisUsername: process.env.REDIS_USERNAME,
  redisPassword: process.env.REDIS_PASSWORD,
  redisTls: process.env.REDIS_TLS === 'true',
  redisClusterMode: process.env.REDIS_CLUSTER_MODE === 'true',
}

export default redisConfig

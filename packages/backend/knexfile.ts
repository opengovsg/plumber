import { config } from './src/config/database'

export default {
  ...config,
  seeds: {
    directory: __dirname + '/src/db/seeds',
  },
  migrations: {
    directory: __dirname + '/src/db/migrations',
  },
}

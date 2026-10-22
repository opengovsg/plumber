import { config } from './src/config/knex-config'

export default {
  ...config,
  seeds: {
    directory: __dirname + '/src/db/seeds',
  },
  migrations: {
    directory: __dirname + '/src/db/migrations',
  },
}

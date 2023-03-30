import { config } from './src/config/database'

export default {
  ...config,
  migrations: {
    directory: __dirname + '/src/db/migrations',
  },
}

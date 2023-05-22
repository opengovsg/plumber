import { config } from 'dotenv'
import knex from 'knex'

const { parsed: env } = config({
  path: '../../packages/backend/.env.staging',
})

if (env.APP_ENV === 'production') {
  console.log('Cannot run seeds in production')
  process.exit(1)
}

export const knexConfig = {
  client: 'pg',
  connection: {
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    user: env.POSTGRES_USERNAME,
    password: env.POSTGRES_PASSWORD,
    database: env.POSTGRES_DATABASE,
    ssl: false,
  },
  pool: { min: 0, max: 20 },
}

export const client = knex(knexConfig)

client
  .raw('SELECT 1')
  .then(() => {
    console.log('db connected')
  })
  .catch((e) => {
    console.log(e)
    console.log('Could not connect to database')
    process.exit(1)
  })

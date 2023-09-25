import dynamoose from 'dynamoose'

import { TableRow } from '@/models/dynamodb/table-row'

import appConfig from './app'

const ddb = new dynamoose.aws.ddb.DynamoDB({
  region: 'ap-southeast-1',
})

if (appConfig.isDev) {
  // Use local dynamodb in development env
  // LOCAL_DYNAMODB_PORT is set in packages/backend/test/ddb-global-setup.ts
  // and is only specified when running integration tests.
  dynamoose.aws.ddb.local(
    `http://localhost:${process.env.LOCAL_DYNAMODB_PORT ?? 8000}`,
  )
} else {
  dynamoose.aws.ddb.set(ddb)
}

dynamoose.Table.defaults.set({
  prefix: `${appConfig.appEnv}-plumber-`,
  // If Dynamoose should attempt to create the table on DynamoDB. True only in dev
  create: appConfig.isDev,
  // If Dynamoose should update the capacity of the existing table to match the model throughput.
  update: false,
  // If Dynamoose should run it's initialization flow (creating the table, updating the throughput, etc) automatically.
  initialize: appConfig.isDev,
})

new dynamoose.Table('table', [TableRow])

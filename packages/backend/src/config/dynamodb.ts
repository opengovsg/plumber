import dynamoose from 'dynamoose'

import { TableRow } from '@/models/dynamodb/table-row'

import appConfig from './app'

const ddb = new dynamoose.aws.ddb.DynamoDB({
  region: 'ap-southeast-1',
})

if (appConfig.isDev) {
  // Use local dynamodb in development env
  dynamoose.aws.ddb.local()
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

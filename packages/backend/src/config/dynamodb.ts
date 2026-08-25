import { DynamoDB } from '@aws-sdk/client-dynamodb'

import appConfig from './app'

const tableSuffix = process.env.DYNAMODB_TABLE_SUFFIX
export const tableName = tableSuffix
  ? `plumber-${appConfig.appEnv}-tiles-${tableSuffix}`
  : `plumber-${appConfig.appEnv}-tiles`

const dynamodbEndpoint = appConfig.isDev
  ? `http://localhost:${process.env.LOCAL_DYNAMODB_PORT ?? 8000}`
  : undefined

const client = new DynamoDB({
  region: 'ap-southeast-1',
  endpoint: dynamodbEndpoint,
})

export async function createDynamoDBTable() {
  const data = await client.listTables({})
  const tableExists = data.TableNames?.includes(tableName)
  if (!tableExists) {
    if (!appConfig.isDev) {
      throw new Error(`Table ${tableName} does not exist`)
    }
    await client.createTable({
      TableName: tableName,
      AttributeDefinitions: [
        { AttributeName: 'tableId', AttributeType: 'S' },
        { AttributeName: 'rowId', AttributeType: 'S' },
        { AttributeName: 'createdAt', AttributeType: 'N' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
      LocalSecondaryIndexes: [
        {
          IndexName: 'createdAtIndex',
          KeySchema: [
            { AttributeName: 'tableId', KeyType: 'HASH' },
            { AttributeName: 'createdAt', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
      KeySchema: [
        { AttributeName: 'tableId', KeyType: 'HASH' },
        { AttributeName: 'rowId', KeyType: 'RANGE' },
      ],
    })
  }
}

export default client

/* eslint-disable no-console */
import { createDynamoDBTable } from '@/config/dynamodb'

createDynamoDBTable().then(() => {
  console.log('Table created')
  process.exit(0)
})

/* oxlint-disable no-console */
import type { AttributeValue } from '@aws-sdk/client-dynamodb'
import { beforeEach } from 'vitest'

import { ensureWorkerIsolation } from './helpers/worker-isolation'

await ensureWorkerIsolation()

const { default: client, tableName } = await import('../src/config/dynamodb')

async function wipeDynamoTable(): Promise<void> {
  let exclusiveStartKey: Record<string, AttributeValue> | undefined

  do {
    const response = await client.scan({
      TableName: tableName,
      ProjectionExpression: 'tableId, rowId',
      ExclusiveStartKey: exclusiveStartKey,
    })

    const items = response.Items ?? []
    for (let index = 0; index < items.length; index += 25) {
      const chunk = items.slice(index, index + 25)
      await client.batchWriteItem({
        RequestItems: {
          [tableName]: chunk.map((item) => ({
            DeleteRequest: {
              Key: {
                tableId: item.tableId,
                rowId: item.rowId,
              },
            },
          })),
        },
      })
    }

    exclusiveStartKey = response.LastEvaluatedKey
  } while (exclusiveStartKey)
}

beforeEach(async () => {
  await wipeDynamoTable()
  console.info('vite: DynamoDB wiped')
})

import { BatchWriteItemCommand } from '@aws-sdk/client-dynamodb'
import client, { tableName } from 'config/dynamodb'
import chunk from 'lodash/chunk'

export async function _batchCreate(
  items: Record<string, any>[],
  attempts = 0,
): Promise<void> {
  const chunks = chunk(items, 25)
  const unprocessedItems: Record<string, any>[] = []
  for (const chunk of chunks) {
    const command = new BatchWriteItemCommand({
      RequestItems: {
        [tableName]: chunk.map((item) => ({
          PutRequest: {
            Item: item,
          },
        })),
      },
    })
    const res = await client.send(command)
    if (res.UnprocessedItems?.[tableName]) {
      console.log('Unprocessed items:', res.UnprocessedItems[tableName])
      unprocessedItems.push(
        ...res.UnprocessedItems[tableName].map((item) => item.PutRequest.Item),
      )
    }
  }
  if (unprocessedItems.length && attempts < 5) {
    console.log(
      `Retry attempt ${attempts + 1} for ${
        unprocessedItems.length
      } unprocessed items`,
    )
    return _batchCreate(unprocessedItems, attempts + 1)
  }
}

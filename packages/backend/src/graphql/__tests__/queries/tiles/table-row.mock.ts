import dynamoose from 'dynamoose'

import appConfig from '@/config/app'
import { TableRowSchema } from '@/models/dynamodb/table-row'

const TABLE_NAME = `${appConfig.appEnv}-plumber-table`

type MockTableRow = Pick<TableRowSchema, 'tableId' | 'rowId'> & {
  data: Record<string, string>
  createdAt?: number
}
const ddb = dynamoose.aws.ddb()
const converter = dynamoose.aws.converter()

export async function insertMockTableRows(rows: MockTableRow[]): Promise<void> {
  // batch in 25 rows at a time
  const BATCH_SIZE = 25
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    await ddb.batchWriteItem({
      RequestItems: {
        [TABLE_NAME]: batch.map((row) => ({
          PutRequest: { Item: converter.marshall(row) },
        })),
      },
    })
  }
}

import { Condition } from 'dynamoose'

export function wrapDynamoDBError(error: unknown): never {
  if (
    error instanceof Error &&
    error.name === 'ConditionalCheckFailedException'
  ) {
    throw new Error('No row found for given table and row id')
  }
  throw error
}

export const rowExistCondition = (tableId: string, rowId: string) =>
  new Condition().where('tableId').eq(tableId).and().where('rowId').eq(rowId)

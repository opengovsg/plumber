import { DynamoDBTableOperations } from './dynamodb/class'
import { PostgresTableOperations } from './pg/class'
import { DatabaseType, TableOperations } from './types'

export function getTableOperations(
  databaseType: DatabaseType,
): TableOperations {
  if (databaseType === 'pg') {
    return new PostgresTableOperations()
  }
  return new DynamoDBTableOperations()
}

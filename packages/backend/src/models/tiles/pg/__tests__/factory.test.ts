import { describe, expect, it } from 'vitest'

import { DynamoDBTableOperations } from '../../dynamodb/class'
import { getTableOperations } from '../../factory'
import { DatabaseType, TableOperations } from '../../types'
import { PostgresTableOperations } from '../class'

describe('getTableOperations', () => {
  it('should return PostgresTableOperations when databaseType is pg', () => {
    const databaseType: DatabaseType = 'pg'
    const tableOperations: TableOperations = getTableOperations(databaseType)

    expect(tableOperations).toBeInstanceOf(PostgresTableOperations)
  })

  it('should return DynamoDBTableOperations when databaseType is not pg', () => {
    const databaseType: DatabaseType = 'ddb'
    const tableOperations: TableOperations = getTableOperations(databaseType)

    expect(tableOperations).toBeInstanceOf(DynamoDBTableOperations)
  })
})

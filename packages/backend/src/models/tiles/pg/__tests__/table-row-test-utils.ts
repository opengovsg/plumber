import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
  generateMockTableRowData,
} from '@/graphql/__tests__/mutations/tiles/table.mock'
import TableMetadata from '@/models/table-metadata'
import Context from '@/types/express/context'

// Test constants
export const TEST_ROW_COUNT = 10
export const PAGINATION_PAGE_SIZE = 4
export const BULK_INSERT_COUNT = 33

// Test data factories
export const createTestRowData = (columnIds: string[]) => {
  return generateMockTableRowData({ columnIds })
}

export const createMultipleTestRows = (count: number, columnIds: string[]) => {
  return new Array(count).fill(0).map(() => createTestRowData(columnIds))
}

// Date test data factory for filtering tests
export const createDateTestData = (columnIds: string[]) => {
  const data = createMultipleTestRows(TEST_ROW_COUNT, columnIds)

  // Set up date column (columnIds[1]) with various ISO string formats
  data[0][columnIds[1]] = '2025-01-01T00:00:00.000'
  data[1][columnIds[1]] = '2025-02-01T00:00:00.000'
  data[2][columnIds[1]] = '2025-03-01T00:00:00.000'
  data[3][columnIds[1]] = '2025-04-01'
  data[4][columnIds[1]] = '2025-05-01'
  data[5][columnIds[1]] = '2025-05-01T00:00:00.000'
  data[6][columnIds[1]] = '2025-05-01T10:00:00.000'
  data[7][columnIds[1]] = '2025-05-01T12:00:00.000'
  data[8][columnIds[1]] = '2025-05-01T12:00:01.000'
  data[9][columnIds[1]] = '2025-05-02'

  return data
}

// String test data factory (for isEmpty and beginsWith tests)
export const createStringTestData = (
  columnIds: string[],
  data: Record<string, string>[],
) => {
  // Set up string column (columnIds[2]) with various empty/null values
  data[0][columnIds[2]] = 'even'
  data[1][columnIds[2]] = null
  data[2][columnIds[2]] = 'even'
  data[3][columnIds[2]] = ''
  data[4][columnIds[2]] = 'even'
  delete data[5][columnIds[2]]
  data[6][columnIds[2]] = 'even'
  data[7][columnIds[2]] = undefined
  data[8][columnIds[2]] = 'even'
  data[9][columnIds[2]] = null

  return data
}

// Numeric test data factory
export const createNumericTestData = (
  columnIds: string[],
  data: Record<string, string>[],
) => {
  // Set up numeric column (columnIds[3]) with various values
  data[0][columnIds[3]] = '5'
  data[1][columnIds[3]] = '10'
  data[2][columnIds[3]] = '20'
  data[3][columnIds[3]] = '30'
  data[4][columnIds[3]] = '40'
  data[5][columnIds[3]] = '140'
  data[6][columnIds[3]] = 'abc'
  data[7][columnIds[3]] = 'def'
  data[8][columnIds[3]] = 'ghi'
  data[9][columnIds[3]] = '-9.99'

  return data
}

// Combined test data factory for complex filtering tests
export const createFilterTestData = (columnIds: string[]) => {
  let data = createDateTestData(columnIds)
  data = createStringTestData(columnIds, data)
  data = createNumericTestData(columnIds, data)
  return data
}

// Helper to clean row data for comparison
export const cleanRowForComparison = (row: any) => {
  const cleaned = { ...row }
  delete cleaned.rowId
  delete cleaned.createdAt
  delete cleaned.updatedAt
  return cleaned
}

// Test setup helper
export interface TestSetup {
  context: Context
  testTable: TableMetadata
  testColumnIds: string[]
}

export const createTestSetup = async (): Promise<TestSetup> => {
  const context = await generateMockContext()

  const mockTable = await generateMockTable({
    userId: context.currentUser.id,
    databaseType: 'pg',
  })
  const testTable = mockTable.table

  const testColumnIds = await generateMockTableColumns({
    tableId: testTable.id,
    numColumns: 5,
    databaseType: 'pg',
  })

  return { context, testTable, testColumnIds }
}

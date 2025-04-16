import { ElectroError } from 'electrodb'

import RetriableError from '@/errors/retriable-error'

import TableColumnMetadata from '../table-column-metadata'

export const DYNAMODB_THROUGHPUT_EXCEEDED_ERROR_MESSAGE =
  'Throughput exceeds the current capacity'

export function handleDynamoDBError(error: unknown): never {
  console.error(error)
  if (error instanceof ElectroError) {
    const message = error.cause?.message || error.message
    // ref: https://electrodb.dev/en/reference/error/#error-classifications
    if (error.code < 2000) {
      throw new Error('DynamoDB Configuration Error: ' + message)
    }
    if (error.code < 3000) {
      throw new Error('DynamoDB Invalid Query Error: ' + message)
    }
    if (error.code < 4000) {
      throw new Error('DynamoDB Validation Error: ' + message)
    }
    if (error.code < 5000) {
      if (message.includes(DYNAMODB_THROUGHPUT_EXCEEDED_ERROR_MESSAGE)) {
        // retry on throughput exceeded
        throw new RetriableError({
          error: message,
          delayInMs: 'default',
          delayType: 'step',
        })
      }
      if (
        message.includes(
          'An operand in the update expression has an incorrect data type',
        ) ||
        message.includes('Incorrect operand type for operator or function')
      ) {
        throw new Error(
          'You can only add or subtract numbers, please check your values.',
        )
      }
      throw new Error('DynamoDB Internal Error: ' + message)
    }
    if (error.code < 6000) {
      throw new Error('DynamoDB Unexpected Error: ' + message)
    }
  }
  if (error instanceof Error) {
    throw new Error('DynamoDB Error: ' + error.message)
  }
  throw new Error('DynamoDB Unknown Error')
}

export function autoMarshallNumberStrings(value: string): string | number {
  // convert all numeric strings such as '123' to numbers
  // only accepts string that contains only numbers and a single decimal point
  if (
    typeof value === 'string' &&
    /^-{0,1}\d+(\.\d+)?$/.test(value) &&
    !isNaN(+value)
  ) {
    if (
      +value <= Number.MAX_SAFE_INTEGER &&
      +value >= Number.MIN_SAFE_INTEGER
    ) {
      return +value
    }
  }
  return value
}

export function autoMarshallDataObj(
  dataObj: Record<string, string>,
): Record<string, string | number> {
  const newObj: Record<string, string | number> = {}
  for (const key in dataObj) {
    newObj[key] = autoMarshallNumberStrings(dataObj[key])
  }
  return newObj
}

export function mapColumnIdsToNames(
  data: Record<string, string | number>,
  columns: TableColumnMetadata[],
): Record<string, string | number> {
  const columnMap = new Map(columns.map((column) => [column.id, column.name]))

  const mappedData: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(data)) {
    if (columnMap.get(key)) {
      mappedData[columnMap.get(key)] = value
    }
  }
  return mappedData
}

export function stripInvalidKeys({
  columnIds,
  data,
}: {
  columnIds: string[]
  data: Record<string, string | number>
}) {
  const strippedData: Record<string, string | number> = {}
  // Iterate through columnIds to maintain order
  for (const columnId of columnIds) {
    if (columnId in data) {
      strippedData[columnId] = data[columnId]
    }
  }
  return strippedData
}

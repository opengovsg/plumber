import { ElectroError } from 'electrodb'

export function handleDynamoDBError(error: unknown): never {
  console.error(error)
  if (error instanceof ElectroError) {
    // ref: https://electrodb.dev/en/reference/error/#error-classifications
    if (error.code < 2000) {
      throw new Error('DynamoDB Configuration Error: ' + error.cause.message)
    }
    if (error.code < 3000) {
      throw new Error('DynamoDB Invalid Query Error: ' + error.cause.message)
    }
    if (error.code < 4000) {
      throw new Error('DynamoDB Validation Error: ' + error.cause.message)
    }
    if (error.code < 5000) {
      throw new Error('DynamoDB Internal Error: ' + error.cause.message)
    }
    if (error.code < 6000) {
      throw new Error('DynamoDB Unexpected Error: ' + error.cause.message)
    }
  }
  if (error instanceof Error) {
    throw new Error('DynamoDB Error: ' + error.message)
  }
  throw new Error('DynamoDB Unknown Error')
}

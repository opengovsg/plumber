import { ElectroError } from 'electrodb'

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

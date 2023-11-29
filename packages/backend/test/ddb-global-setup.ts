/* eslint-disable no-console */
import { GenericContainer, StartedTestContainer } from 'testcontainers'

let dynamodbContainer: StartedTestContainer

// Set dummy AWS credentials for local DynamoDB to work
process.env.AWS_REGION = 'ap-southeast-1'
process.env.AWS_ACCESS_KEY_ID = 'awsaccesskeyid'
process.env.AWS_SECRET_ACCESS_KEY = 'awssecretaccesskey'

export async function setup() {
  dynamodbContainer = await new GenericContainer('amazon/dynamodb-local')
    .withExposedPorts(8000)
    .withEnvironment({
      REGION: 'ap-southeast-1',
    })
    .withCommand(['-jar', 'DynamoDBLocal.jar', '-inMemory', '-sharedDb'])
    .start()

  const mappedPort = dynamodbContainer.getMappedPort(8000).toString()
  process.env.LOCAL_DYNAMODB_PORT = mappedPort

  const { createDynamoDBTable } = await import('../src/config/dynamodb')
  await createDynamoDBTable()
  console.log('DynamoDB table created')

  console.info(`DynamoDB container started at port ${mappedPort}`)
}

export async function teardown() {
  if (!dynamodbContainer) {
    return
  }
  await dynamodbContainer.stop({ remove: true })
  console.info(`DynamoDB container stopped`)
}

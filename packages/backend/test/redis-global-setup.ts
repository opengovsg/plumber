import { GenericContainer, StartedTestContainer } from 'testcontainers'

let redisContainer: StartedTestContainer

export async function setup() {
  redisContainer = await new GenericContainer('redis:6.2.0-alpine')
    .withExposedPorts(6379)
    .start()

  const mappedPort = redisContainer.getMappedPort(6379).toString()
  process.env.REDIS_PORT = mappedPort

  console.info(`Redis container started at port ${mappedPort}`)
}

export async function teardown() {
  if (!redisContainer) {
    return
  }
  await redisContainer.stop({ remove: true })
  console.info(`Redis container stopped`)
}

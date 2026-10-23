import { describe, expect, it } from 'vitest'

type QueueWithRedisClient = {
  client: Promise<{
    set: (key: string, value: string) => Promise<unknown>
    get: (key: string) => Promise<string | null>
  }>
}

describe('queue modules in unit tests', () => {
  it('runs the flow queue against in-memory redis', async () => {
    const { default: flowQueue } = (await import('@/queues/flow.js')) as unknown as {
      default: QueueWithRedisClient
    }
    const client = await flowQueue.client

    await client.set('flow-queue-key', 'ok')

    expect(await client.get('flow-queue-key')).toBe('ok')
  })

  it('runs the trigger queue against in-memory redis', async () => {
    const { default: triggerQueue } = (await import(
      '@/queues/trigger.js'
    )) as unknown as { default: QueueWithRedisClient }
    const client = await triggerQueue.client

    await client.set('trigger-queue-key', 'ok')

    expect(await client.get('trigger-queue-key')).toBe('ok')
  })
})

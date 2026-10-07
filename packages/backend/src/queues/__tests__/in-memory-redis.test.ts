import { describe, expect, it } from 'vitest'

describe('queue modules in unit tests', () => {
  it('runs the flow queue against in-memory redis', async () => {
    const flowQueue = (await import('@/queues/flow')).default
    const client = await flowQueue.client

    await client.set('flow-queue-key', 'ok')

    expect(await client.get('flow-queue-key')).toBe('ok')
  })

  it('runs the trigger queue against in-memory redis', async () => {
    const triggerQueue = (await import('@/queues/trigger')).default
    const client = await triggerQueue.client

    await client.set('trigger-queue-key', 'ok')

    expect(await client.get('trigger-queue-key')).toBe('ok')
  })
})

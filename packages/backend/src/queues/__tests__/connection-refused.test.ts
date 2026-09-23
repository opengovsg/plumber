import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/helpers/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

const CONNECTION_REFUSED_ERROR = Object.assign(
  new Error('connect ECONNREFUSED 127.0.0.1:6379'),
  { code: 'ECONNREFUSED' },
)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('queue modules when redis refuses a connection', () => {
  it('keeps the vitest worker alive for the flow queue', async () => {
    const exit = vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
    const flowQueue = (await import('@/queues/flow')).default

    flowQueue.emit('error', CONNECTION_REFUSED_ERROR)

    expect(exit).not.toHaveBeenCalled()
  })

  it('keeps the vitest worker alive for the trigger queue', async () => {
    const exit = vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
    const triggerQueue = (await import('@/queues/trigger')).default

    triggerQueue.emit('error', CONNECTION_REFUSED_ERROR)

    expect(exit).not.toHaveBeenCalled()
  })
})

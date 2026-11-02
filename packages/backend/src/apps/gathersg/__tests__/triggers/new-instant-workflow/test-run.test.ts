import type { IGlobalVariable } from '@plumber/types'
import { describe, expect, it, vi } from 'vitest'

import trigger from '../../../triggers/new-instant-workflow'

describe('newInstantWorkflow testRun', () => {
  it('tags an invalid encryption key as config', async () => {
    const $ = {
      step: { parameters: { encryptionKey: 'short' } },
      getLastExecutionStep: vi.fn(),
      pushTriggerItem: vi.fn(),
    } as unknown as IGlobalVariable

    await expect(trigger.testRun($)).rejects.toMatchObject({
      kind: 'config',
      message: expect.stringContaining('Encryption key is not valid'),
    })
    expect($.pushTriggerItem).not.toHaveBeenCalled()
  })
})

import { randomUUID } from 'crypto'
import { describe, expect, it, vi } from 'vitest'

import Flow from '@/models/flow'

import { checkErrorEmail, sendErrorEmail } from '../generate-error-email'

// Mock luxon
vi.mock('luxon', () => {
  return {
    DateTime: {
      now: () => ({
        toMillis: () => 1696953540000, // 2023-10-10T23:59:00.000+08:00
        endOf: (_interval: string) => ({
          toMillis: () => 1696953599000, // 2024-10-10T23:59:59.000+08:00
        }),
        toFormat: (_format: string) => '10 Oct 2024 at 11:59:00 PM',
      }),
    },
  }
})

// Mock sendEmail
vi.mock('@/helpers/send-email', () => {
  return {
    sendEmail: () => Promise.resolve(),
  }
})

describe('generate error email', () => {
  it('should check if error email has already been sent', async () => {
    const errorEmailExists = await checkErrorEmail(randomUUID())
    expect(errorEmailExists).toBe(0)
  })

  it('should send an error email for a given flow id', async () => {
    await expect(
      sendErrorEmail(
        {
          id: randomUUID(),
          name: 'test flow 2',
        } as Flow,
        'dc144fcf-7004-4269-b74c-a76ccc0e7d21@email.webhook.site',
      ),
    ).resolves.toBeUndefined()
  })
})

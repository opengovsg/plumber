import { randomUUID } from 'crypto'
import { describe, expect, it, vi } from 'vitest'

import Flow from '@/models/flow'

import { checkErrorEmail, sendErrorEmail } from '../generate-error-email'

const randomFlowId = randomUUID()
const randomFlowName = 'flowww'
const randomEmail = 'test@open.gov.sg'
const currTestTimestamp = 1917878340000

const mocks = vi.hoisted(() => {
  return {
    sendEmail: vi.fn(),
  }
})

// Mock luxon
vi.mock('luxon', () => {
  return {
    DateTime: {
      now: () => ({
        toMillis: () => currTestTimestamp, // 2030-10-10T23:59:00.000+08:00
        endOf: (_interval: string) => ({
          toMillis: () => 1917878399000, // 2030-10-10T23:59:59.000+08:00
        }),
        toFormat: (_format: string) => '10 Oct 2030 at 11:59:00 PM',
      }),
    },
  }
})

// Mock sendEmail
vi.mock('@/helpers/send-email', () => {
  return {
    sendEmail: mocks.sendEmail,
  }
})

describe('generate error email', () => {
  it('check if error email has been sent the first time', async () => {
    const errorEmailExists = await checkErrorEmail(randomFlowId)
    expect(errorEmailExists).toBe(false)
  })

  it('send email has encountered an error', async () => {
    mocks.sendEmail.mockImplementation(() => Promise.reject())
    await expect(
      sendErrorEmail({
        id: randomFlowId,
        name: randomFlowName,
        user: {
          email: randomEmail,
        },
      } as Flow),
    ).rejects.toBeUndefined()
  })

  it('send an error email for a given flow id', async () => {
    mocks.sendEmail.mockImplementation(() => Promise.resolve())
    await expect(
      sendErrorEmail({
        id: randomFlowId,
        name: randomFlowName,
        user: {
          email: randomEmail,
        },
      } as Flow),
    ).resolves.toEqual({
      flowId: randomFlowId,
      flowName: randomFlowName,
      userEmail: randomEmail,
      timestamp: currTestTimestamp,
    })
  })

  it('error email has already been sent, should not send again', async () => {
    const errorEmailExists = await checkErrorEmail(randomFlowId)
    expect(errorEmailExists).toBe(true)
  })
})

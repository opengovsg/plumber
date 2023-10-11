import { randomUUID } from 'crypto'
import { describe, expect, it, vi } from 'vitest'

import Flow from '@/models/flow'

import {
  checkErrorEmail,
  redisClient,
  sendErrorEmail,
} from '../generate-error-email'

const randomFlowName = 'flowww'
const randomEmail = 'test@open.gov.sg'
const currTestTimestamp = 1917878340000
const endOfTimestamp = 1917878399000

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
          toMillis: () => endOfTimestamp, // 2030-10-10T23:59:59.000+08:00
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
    const randomFlowId = randomUUID()
    const errorEmailExists = await checkErrorEmail(randomFlowId)
    expect(errorEmailExists).toBe(false)
  })

  it('does not store redis item if email has encountered an error', async () => {
    const randomFlowId = randomUUID()
    const key = `error-alert:${randomFlowId}`
    mocks.sendEmail.mockImplementationOnce(() => Promise.reject())
    await expect(
      sendErrorEmail({
        id: randomFlowId,
        name: randomFlowName,
        user: {
          email: randomEmail,
        },
      } as Flow),
    ).rejects.toBeUndefined()
    expect(!!(await redisClient.exists(key))).toBe(false)
  })

  it('send an error email for a given flow id', async () => {
    const randomFlowId = randomUUID()
    const key = `error-alert:${randomFlowId}`
    const keyObject = {
      flowId: randomFlowId,
      flowName: randomFlowName,
      userEmail: randomEmail,
      timestamp: currTestTimestamp,
    }
    mocks.sendEmail.mockImplementationOnce(() => Promise.resolve())
    await expect(
      sendErrorEmail({
        id: randomFlowId,
        name: randomFlowName,
        user: {
          email: randomEmail,
        },
      } as Flow),
    ).resolves.toEqual(keyObject)
    // check for TTL (1s gap)
    const keyTTL = await redisClient.pttl(key)
    const simulatedTTL = endOfTimestamp - Date.now()
    const timeGap = Math.abs(keyTTL - simulatedTTL)
    expect(timeGap).toBeLessThan(1000)
  })

  it('error email has already been sent, should not send again', async () => {
    const randomFlowId = randomUUID()
    const key = `error-alert:${randomFlowId}`
    const keyObject = {
      flowId: randomFlowId,
      flowName: randomFlowName,
      userEmail: randomEmail,
      timestamp: currTestTimestamp,
    }
    redisClient.hset(key, keyObject)
    const errorEmailExists = await checkErrorEmail(randomFlowId)
    expect(errorEmailExists).toBe(true)
  })
})

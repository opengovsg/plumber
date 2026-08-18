import { BulkEmailEntryResult } from '@aws-sdk/client-sesv2'
import { describe, expect, it } from 'vitest'

import { getSesBulkEntryStatus } from '../../common/throw-errors'

describe('getSesBulkEntryStatus', () => {
  it.each<{ result: BulkEmailEntryResult; expected: string }>([
    // Throttling — retriable, so it maps onto our auto-retry status.
    { result: { Status: 'ACCOUNT_THROTTLED' }, expected: 'RATE-LIMITED' },
    {
      result: { Status: 'ACCOUNT_DAILY_QUOTA_EXCEEDED' },
      expected: 'RATE-LIMITED',
    },

    { result: { Status: 'TRANSIENT_FAILURE' }, expected: 'INTERMITTENT-ERROR' },

    // MESSAGE_REJECTED is only a blacklist when the error text says so.
    {
      result: {
        Status: 'MESSAGE_REJECTED',
        Error: 'Recipient email is blacklisted',
      },
      expected: 'BLACKLISTED',
    },
    {
      result: {
        Status: 'MESSAGE_REJECTED',
        Error: 'Address is on the account-level suppression list',
      },
      expected: 'BLACKLISTED',
    },
    {
      result: {
        Status: 'MESSAGE_REJECTED',
        Error: 'Email address is not verified',
      },
      expected: 'ERROR',
    },
    { result: { Status: 'MESSAGE_REJECTED' }, expected: 'ERROR' },

    // Everything else is not retriable on our side.
    { result: { Status: 'FAILED' }, expected: 'ERROR' },
    { result: { Status: 'INVALID_PARAMETER' }, expected: 'ERROR' },
    { result: { Status: 'ACCOUNT_SUSPENDED' }, expected: 'ERROR' },
    { result: { Status: 'ACCOUNT_SENDING_PAUSED' }, expected: 'ERROR' },
    { result: { Status: 'CONFIGURATION_SET_NOT_FOUND' }, expected: 'ERROR' },
    { result: { Status: 'MAIL_FROM_DOMAIN_NOT_VERIFIED' }, expected: 'ERROR' },
    { result: {}, expected: 'ERROR' },
  ])('maps $result.Status to $expected', ({ result, expected }) => {
    expect(getSesBulkEntryStatus(result)).toBe(expected)
  })

  it('is case-insensitive when sniffing the rejection reason', () => {
    expect(
      getSesBulkEntryStatus({
        Status: 'MESSAGE_REJECTED',
        Error: 'Recipient Email Is BLACKLISTED',
      }),
    ).toBe('BLACKLISTED')
  })
})

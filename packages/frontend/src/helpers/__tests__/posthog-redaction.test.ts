import type { CaptureResult } from 'posthog-js'
import { describe, expect, it } from 'vitest'

import {
  REDACTED_EMAIL,
  redactEmails,
  redactPostHogEvent,
} from '@/helpers/posthog-redaction'

function makeEvent(overrides: Partial<CaptureResult>): CaptureResult {
  return {
    uuid: 'uuid',
    event: '$pageview',
    properties: {},
    ...overrides,
  }
}

describe('redactEmails', () => {
  it('redacts a raw email and keeps the text around it', () => {
    expect(
      redactEmails(
        'GET https://api.test/respondent/jane.doe@agency.gov.sg-abc',
      ),
    ).toBe(`GET https://api.test/respondent/${REDACTED_EMAIL}-abc`)
  })

  it('redacts a URL-encoded email', () => {
    expect(
      redactEmails('https://app.test/user/jane%40agency.gov.sg/pipe/1'),
    ).toBe(`https://app.test/user/${REDACTED_EMAIL}/pipe/1`)
  })

  it('leaves text without an email unchanged', () => {
    const url = 'https://app.test/editor/7510a685-687f-4445-99a9-53f32180ac71'
    expect(redactEmails(url)).toBe(url)
  })
})

describe('redactPostHogEvent', () => {
  it('returns null unchanged', () => {
    expect(redactPostHogEvent(null)).toBeNull()
  })

  it('redacts emails in URL properties', () => {
    const event = redactPostHogEvent(
      makeEvent({
        properties: {
          $current_url: 'https://app.test/user/jane%40agency.gov.sg',
          $pathname: '/user/jane@agency.gov.sg',
          $referrer: 'https://app.test/?email=jane@agency.gov.sg',
          $session_entry_url: 'https://app.test/user/jane@agency.gov.sg',
        },
        $set_once: {
          $initial_current_url: 'https://app.test/user/jane@agency.gov.sg',
        },
      }),
    )

    expect(event?.properties).toEqual({
      $current_url: `https://app.test/user/${REDACTED_EMAIL}`,
      $pathname: `/user/${REDACTED_EMAIL}`,
      $referrer: `https://app.test/?email=${REDACTED_EMAIL}`,
      $session_entry_url: `https://app.test/user/${REDACTED_EMAIL}`,
    })
    expect(event?.$set_once).toEqual({
      $initial_current_url: `https://app.test/user/${REDACTED_EMAIL}`,
    })
  })

  it('redacts emails in exception messages', () => {
    const message =
      'Request failed with status code 403: GET https://api.test/respondent/jane@agency.gov.sg-abc'
    const event = redactPostHogEvent(
      makeEvent({
        event: '$exception',
        properties: {
          $exception_values: [message],
          $exception_list: [{ type: 'HTTPError', value: message }],
        },
      }),
    )

    const expected = `Request failed with status code 403: GET https://api.test/respondent/${REDACTED_EMAIL}-abc`
    expect(event?.properties.$exception_values).toEqual([expected])
    expect(event?.properties.$exception_list).toEqual([
      { type: 'HTTPError', value: expected },
    ])
  })

  it('keeps the email person property set on identify', () => {
    const event = redactPostHogEvent(
      makeEvent({
        event: '$identify',
        $set: { email: 'jane@agency.gov.sg' },
      }),
    )

    expect(event?.$set).toEqual({ email: 'jane@agency.gov.sg' })
  })
})

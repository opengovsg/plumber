import type { AwsCredentialIdentity } from '@aws-sdk/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { formatFromAddress } from '../ses-email-helper'

const mocks = vi.hoisted(() => {
  const send = vi.fn(async () => ({}))
  const SESv2Client = vi.fn(function (
    this: { send: typeof send },
    _config: unknown,
  ) {
    this.send = send
  })
  const SendEmailCommand = vi.fn(function (
    this: { input: unknown },
    input: unknown,
  ) {
    this.input = input
  })
  return {
    send,
    SESv2Client,
    SendEmailCommand,
    sendEmailCommand: SendEmailCommand,
    fromTemporaryCredentials: vi.fn(
      (_params: unknown) => 'temporary-credentials-provider',
    ),
    getSuppressedEmails: vi.fn(async () => [] as string[]),
    sesConfig: {
      fromAddress: 'admin@example.gov.sg',
      region: 'ap-southeast-1',
      roleArn: 'arn:aws:iam::123456789012:role/ses-sender',
      credentials: undefined as AwsCredentialIdentity | undefined,
    },
  }
})

vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: mocks.SESv2Client,
  SendEmailCommand: mocks.SendEmailCommand,
}))

vi.mock('@aws-sdk/credential-providers', () => ({
  fromTemporaryCredentials: mocks.fromTemporaryCredentials,
}))

vi.mock('@/config/app', () => ({
  default: {
    get ses() {
      return mocks.sesConfig
    },
  },
}))

vi.mock('@/models/email-suppression-entry', () => ({
  default: { getSuppressedEmails: mocks.getSuppressedEmails },
}))

vi.mock('@/helpers/launch-darkly', () => ({ getLdFlagValue: vi.fn() }))

vi.mock('@/helpers/metrics', () => ({ incrementMetric: vi.fn() }))

vi.mock('@/helpers/logger', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}))

// getSesClient memoises its client, so every test needs a fresh module.
async function importFresh() {
  vi.resetModules()
  return import('../ses-email-helper.js')
}

describe('formatFromAddress', () => {
  it('leaves a simple display name unquoted', () => {
    expect(formatFromAddress('HR Department', 'info@plumber.gov.sg')).toBe(
      'HR Department <info@plumber.gov.sg>',
    )
  })

  it('quotes a display name containing a comma (the SES-breaking case)', () => {
    expect(formatFromAddress('Acme, Inc', 'info@plumber.gov.sg')).toBe(
      '"Acme, Inc" <info@plumber.gov.sg>',
    )
  })

  it('quotes other RFC 5322 specials (semicolon, colon, parens)', () => {
    expect(formatFromAddress('Dept; Unit', 'a@b.gov.sg')).toBe(
      '"Dept; Unit" <a@b.gov.sg>',
    )
    expect(formatFromAddress('Team (Ops)', 'a@b.gov.sg')).toBe(
      '"Team (Ops)" <a@b.gov.sg>',
    )
  })

  it('escapes embedded quotes and backslashes when quoting', () => {
    expect(formatFromAddress('A, "B" \\C', 'a@b.gov.sg')).toBe(
      '"A, \\"B\\" \\\\C" <a@b.gov.sg>',
    )
  })
})

describe('getSesClient', () => {
  beforeEach(() => {
    mocks.SESv2Client.mockClear()
    mocks.fromTemporaryCredentials.mockClear()
    mocks.sesConfig.region = 'ap-southeast-1'
    mocks.sesConfig.credentials = undefined
  })

  it('builds the client in the configured region', async () => {
    mocks.sesConfig.region = 'ap-southeast-2'

    const { getSesClient } = await importFresh()
    getSesClient()

    expect(mocks.SESv2Client).toHaveBeenCalledTimes(1)
    expect(mocks.SESv2Client.mock.calls[0][0]).toMatchObject({
      region: 'ap-southeast-2',
      credentials: 'temporary-credentials-provider',
    })
  })

  it('always assumes the configured role', async () => {
    const { getSesClient } = await importFresh()
    getSesClient()

    expect(mocks.fromTemporaryCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          RoleArn: 'arn:aws:iam::123456789012:role/ses-sender',
          ExternalId: 'plumber-ses-access',
        },
      }),
    )
  })

  it('uses the explicit credentials as master credentials when configured', async () => {
    mocks.sesConfig.credentials = {
      accessKeyId: 'AKIAVAPT',
      secretAccessKey: 'vapt-secret',
    }

    const { getSesClient } = await importFresh()
    getSesClient()

    expect(mocks.fromTemporaryCredentials.mock.calls[0][0]).toMatchObject({
      masterCredentials: {
        accessKeyId: 'AKIAVAPT',
        secretAccessKey: 'vapt-secret',
      },
    })
  })

  // An undefined masterCredentials is what makes the SDK resolve the role via
  // the default provider chain (SSO locally, task role in ECS).
  it('leaves master credentials undefined when none are configured', async () => {
    const { getSesClient } = await importFresh()
    getSesClient()

    expect(mocks.fromTemporaryCredentials.mock.calls[0][0]).toHaveProperty(
      'masterCredentials',
      undefined,
    )
  })

  it('memoises the client across calls', async () => {
    const { getSesClient } = await importFresh()

    expect(getSesClient()).toBe(getSesClient())
    expect(mocks.SESv2Client).toHaveBeenCalledTimes(1)
  })
})

describe('sendEmailViaSes', () => {
  beforeEach(() => {
    mocks.send.mockClear()
    mocks.SendEmailCommand.mockClear()
    mocks.getSuppressedEmails.mockResolvedValue([])
    mocks.sesConfig.fromAddress = 'admin@example.gov.sg'
  })

  it('sends from the configured from address', async () => {
    mocks.sesConfig.fromAddress = 'noreply@agency.gov.sg'

    const { sendEmailViaSes } = await importFresh()
    await sendEmailViaSes({
      subject: 'Hello',
      body: '<p>Hi</p>',
      recipient: 'someone@agency.gov.sg',
    })

    expect(mocks.SendEmailCommand.mock.calls[0][0]).toMatchObject({
      FromEmailAddress: 'Plumber <noreply@agency.gov.sg>',
    })
  })
})

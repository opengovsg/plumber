import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildReportEmail,
  REPORT_RECIPIENT,
  sendReportEmail,
} from '@/models/tiles/migration/report-email'

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  appConfig: { appEnv: 'prod', isDev: false },
}))

vi.mock('@/config/app', () => ({ default: mocks.appConfig }))
vi.mock('@/helpers/send-email', () => ({ sendEmail: mocks.sendEmail }))

const report = {
  migrated: 3,
  skipped: 1,
  aborted: 1,
  failed: 1,
  remaining: 7,
  failedTableIds: ['failed-id'],
  abortedTableIds: ['aborted-<id>'],
}

describe('buildReportEmail', () => {
  it('summarises a run with tiles left', () => {
    const { subject, body } = buildReportEmail(report)
    expect(subject).toBe(
      'Plumber (prod): tiles migration run, 3 migrated, 7 left',
    )
    expect(body).toContain('Remaining: 7')
    expect(body).toContain('<li>failed-id</li>')
    expect(body).toContain('<li>aborted-&lt;id&gt;</li>')
  })

  it('says the migration is complete when no tiles are left', () => {
    const { subject, body } = buildReportEmail({
      ...report,
      remaining: 0,
      failedTableIds: [],
      abortedTableIds: [],
    })
    expect(subject).toBe('Plumber (prod): tiles migration complete')
    expect(body).toContain('remove the nightly tiles-migration worker')
    expect(body).not.toContain('Failed tiles')
  })
})

describe('sendReportEmail', () => {
  afterEach(() => {
    vi.clearAllMocks()
    mocks.appConfig.isDev = false
  })

  it('emails the team', async () => {
    await sendReportEmail(report)
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: REPORT_RECIPIENT }),
    )
  })

  it('does not throw when sending fails', async () => {
    mocks.sendEmail.mockRejectedValueOnce(new Error('Postman down'))
    await expect(sendReportEmail(report)).resolves.toBeUndefined()
  })

  it('skips local runs', async () => {
    mocks.appConfig.isDev = true
    await sendReportEmail(report)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })
})

import { readFileSync } from 'fs'
import { resolve } from 'path'

import { describe, expect, it } from 'vitest'

import { parseSqsMessage } from '@/helpers/ses-event-parser'
import EmailSuppressionEntry from '@/models/email-suppression-entry'

import { processSesEvent } from '../process-ses-event'

function loadFixture(name: string): string {
  return readFileSync(
    resolve(__dirname, '../../../ses-test-events', name),
    'utf-8',
  )
}

function makeJobData(fixtureName: string) {
  return {
    sesEvent: parseSqsMessage(loadFixture(fixtureName)),
    sqsMessageId: `test-sqs-${fixtureName}`,
  }
}

describe('processSesEvent', () => {
  it('should suppress email on permanent bounce', async () => {
    await processSesEvent(makeJobData('ses-bounce-permanent.json'))

    const suppressed = await EmailSuppressionEntry.getSuppressedEmails([
      'bounce@example.com',
    ])
    expect(suppressed).toEqual(['bounce@example.com'])

    const row = await EmailSuppressionEntry.query().findOne({
      email: 'bounce@example.com',
    })
    expect(row.reason).toBe('BOUNCE')
    expect(row.reasonDetail).toBe('NoEmail')
    expect(row.sesMessageId).toBe('ses-msg-001')
  })

  it('should NOT suppress email on transient bounce', async () => {
    await processSesEvent(makeJobData('ses-bounce-transient.json'))

    const suppressed = await EmailSuppressionEntry.getSuppressedEmails([
      'full@example.com',
    ])
    expect(suppressed).toEqual([])
  })

  it('should suppress email on abuse complaint', async () => {
    await processSesEvent(makeJobData('ses-complaint-abuse.json'))

    const suppressed = await EmailSuppressionEntry.getSuppressedEmails([
      'complainer@example.com',
    ])
    expect(suppressed).toEqual(['complainer@example.com'])

    const row = await EmailSuppressionEntry.query().findOne({
      email: 'complainer@example.com',
    })
    expect(row.reason).toBe('COMPLAINT')
    expect(row.reasonDetail).toBe('abuse')
  })

  it('should auto-whitelist on not-spam complaint', async () => {
    // First suppress the email
    await EmailSuppressionEntry.upsertSuppression({
      email: 'notspam@example.com',
      reason: 'COMPLAINT',
      reasonDetail: 'abuse',
    })

    // Then process not-spam complaint
    await processSesEvent(makeJobData('ses-complaint-not-spam.json'))

    const suppressed = await EmailSuppressionEntry.getSuppressedEmails([
      'notspam@example.com',
    ])
    expect(suppressed).toEqual([])

    const row = await EmailSuppressionEntry.query().findOne({
      email: 'notspam@example.com',
    })
    expect(row.lastWhitelistedAt).not.toBeNull()
  })

  it('should handle not-spam complaint for non-suppressed email gracefully', async () => {
    await processSesEvent(makeJobData('ses-complaint-not-spam.json'))

    const rows = await EmailSuppressionEntry.query().where({
      email: 'notspam@example.com',
    })
    expect(rows).toHaveLength(0)
  })

  it('should be idempotent — processing same bounce twice does not duplicate', async () => {
    await processSesEvent(makeJobData('ses-bounce-permanent.json'))
    await processSesEvent(makeJobData('ses-bounce-permanent.json'))

    const rows = await EmailSuppressionEntry.query().where({
      email: 'bounce@example.com',
    })
    expect(rows).toHaveLength(1)
  })
})

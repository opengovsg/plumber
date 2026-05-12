import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

import { parseSqsMessage, SesEventType } from '@/helpers/ses-event-parser'

function loadFixture(name: string): string {
  return readFileSync(
    resolve(__dirname, '../../../ses-test-events', name),
    'utf-8',
  )
}

describe('ses-event-parser', () => {
  describe('parseSqsMessage', () => {
    it('should parse a permanent bounce event', () => {
      const result = parseSqsMessage(loadFixture('ses-bounce-permanent.json'))
      expect(result.eventType).toBe(SesEventType.Bounce)
      expect(result.bounce).toBeDefined()
      expect(result.bounce.bounceType).toBe('Permanent')
      expect(result.bounce.bounceSubType).toBe('NoEmail')
      expect(result.bounce.bouncedRecipients).toHaveLength(1)
      expect(result.bounce.bouncedRecipients[0].emailAddress).toBe(
        'bounce@example.com',
      )
      expect(result.mail.messageId).toBe('ses-msg-001')
    })

    it('should parse a transient bounce event', () => {
      const result = parseSqsMessage(loadFixture('ses-bounce-transient.json'))
      expect(result.eventType).toBe(SesEventType.Bounce)
      expect(result.bounce.bounceType).toBe('Transient')
      expect(result.bounce.bounceSubType).toBe('MailboxFull')
    })

    it('should parse a complaint event', () => {
      const result = parseSqsMessage(loadFixture('ses-complaint-abuse.json'))
      expect(result.eventType).toBe(SesEventType.Complaint)
      expect(result.complaint).toBeDefined()
      expect(result.complaint.complaintFeedbackType).toBe('abuse')
      expect(result.complaint.complainedRecipients).toHaveLength(1)
      expect(result.complaint.complainedRecipients[0].emailAddress).toBe(
        'complainer@example.com',
      )
    })

    it('should parse a not-spam complaint event', () => {
      const result = parseSqsMessage(loadFixture('ses-complaint-not-spam.json'))
      expect(result.eventType).toBe(SesEventType.Complaint)
      expect(result.complaint.complaintFeedbackType).toBe('not-spam')
    })

    it('should throw on invalid JSON in SQS body', () => {
      expect(() => parseSqsMessage('not json')).toThrow()
    })

    it('should throw on missing Message field in SNS envelope', () => {
      expect(() =>
        parseSqsMessage(JSON.stringify({ Type: 'Notification' })),
      ).toThrow('Missing Message field in SNS envelope')
    })

    it('should throw on missing eventType in SES event', () => {
      const snsEnvelope = JSON.stringify({
        Type: 'Notification',
        Message: JSON.stringify({ mail: {} }),
      })
      expect(() => parseSqsMessage(snsEnvelope)).toThrow(
        'Missing eventType in SES event',
      )
    })
  })
})

import { Settings as LuxonSettings } from 'luxon'
import { beforeAll, describe, expect, it } from 'vitest'

import { computeSubmissionTime } from '../../auth/helpers/compute-submission-time'

// TZ formatting replicated here (see appConfig) as tests don't load the app
// config module.
beforeAll(() => {
  LuxonSettings.defaultZone = 'Asia/Singapore'
  LuxonSettings.defaultLocale = 'en-SG'
})

describe('computeSubmissionTime', () => {
  describe('SRF (non-MRF) forms', () => {
    it('returns submission creation time converted to SGT', () => {
      const result = computeSubmissionTime({
        created: '2024-01-15T08:30:00.000Z',
      })
      // UTC+8 => 16:30 SGT
      expect(result).toBe('2024-01-15T16:30:00.000+08:00')
    })

    it('returns creation time when workflowContent is undefined', () => {
      const result = computeSubmissionTime({
        created: '2024-06-01T00:00:00.000Z',
        workflowContent: undefined,
      })
      expect(result).toBe('2024-06-01T08:00:00.000+08:00')
    })

    it('returns creation time when submittedSteps is empty', () => {
      const result = computeSubmissionTime({
        created: '2024-01-15T08:30:00.000Z',
        workflowContent: {
          workflow: [] as any,
          workflowStep: 0,
          submittedSteps: [],
        },
      })
      expect(result).toBe('2024-01-15T16:30:00.000+08:00')
    })
  })

  describe('MRF forms', () => {
    it('returns last submitted step time converted to SGT', () => {
      const result = computeSubmissionTime({
        created: '2024-01-15T08:30:00.000Z',
        workflowContent: {
          workflow: [] as any,
          workflowStep: 1,
          submittedSteps: [
            {
              isApproval: false,
              submittedAt: '2024-01-15T10:00:00.000Z',
            },
          ],
        },
      })
      // Uses submittedAt (10:00 UTC => 18:00 SGT), not created
      expect(result).toBe('2024-01-15T18:00:00.000+08:00')
    })

    it('returns the last step time when multiple steps exist', () => {
      const result = computeSubmissionTime({
        created: '2024-01-15T08:30:00.000Z',
        workflowContent: {
          workflow: [] as any,
          workflowStep: 2,
          submittedSteps: [
            {
              isApproval: false,
              submittedAt: '2024-01-15T10:00:00.000Z',
            },
            {
              isApproval: true,
              submittedAt: '2024-01-16T03:45:00.000Z',
              status: 'APPROVED' as const,
            },
          ],
        },
      })
      // Last step: 2024-01-16T03:45 UTC => 2024-01-16T11:45 SGT
      expect(result).toBe('2024-01-16T11:45:00.000+08:00')
    })

    it('handles midnight UTC crossing into next day SGT', () => {
      const result = computeSubmissionTime({
        created: '2024-01-15T08:30:00.000Z',
        workflowContent: {
          workflow: [] as any,
          workflowStep: 1,
          submittedSteps: [
            {
              isApproval: false,
              submittedAt: '2024-01-15T23:00:00.000Z',
            },
          ],
        },
      })
      // 23:00 UTC => 07:00 next day SGT
      expect(result).toBe('2024-01-16T07:00:00.000+08:00')
    })
  })
})

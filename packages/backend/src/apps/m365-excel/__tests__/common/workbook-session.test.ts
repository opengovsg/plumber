import { ExecutionError, ResourceLockedError } from 'redlock'
import { describe, expect, it } from 'vitest'

import { M365TenantInfo } from '@/config/app-env-vars/m365'
import RetriableError from '@/errors/retriable-error'

import { runWithLockElseRetryStep } from '../../common/workbook-session/redis'

const SAMPLE_M365_TENANT: M365TenantInfo = {
  label: 'sample',
  id: 'sample-id',
  sharePointSiteId: 'sample-sp-site-id',
  clientId: 'sample-client-id',
  clientThumbprint: 'sample-thumbprint',
  clientPrivateKey: 'sample-private-key',
  allowedSensitivityLabelGuids: new Set(['sample-guid']),
}

describe('Excel workbook session', () => {
  describe('runWithLockElseRetryStep', () => {
    it('retries lock failures', async () => {
      const testInvocation = async () =>
        await runWithLockElseRetryStep(
          SAMPLE_M365_TENANT,
          'fake-file',
          // Treat callback as a mock instead of mocking redlock (it feels like
          // mocking redlock will make this test too fragile).
          async () => {
            throw new ResourceLockedError('test error')
          },
        )
      expect(testInvocation).rejects.toThrow(RetriableError)
    })

    it('retries quorum failures', async () => {
      const testInvocation = async () =>
        await runWithLockElseRetryStep(
          SAMPLE_M365_TENANT,
          'fake-file',
          async () => {
            throw new ExecutionError(
              'The operation was unable to achieve a quorum during its retry window.',
              [],
            )
          },
        )
      expect(testInvocation).rejects.toThrow(RetriableError)
    })
  })
})

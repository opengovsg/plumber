import type { IGlobalVariable } from '@plumber/types'

import type { AxiosRequestConfig, AxiosResponse } from 'axios'

import {
  getM365TenantInfo,
  type M365TenantInfo,
} from '@/config/app-env-vars/m365'
import HttpError from '@/errors/http'
import RetriableError from '@/errors/retriable-error'
import logger from '@/helpers/logger'

import { extractAuthDataWithPlumberFolder } from '../auth-data'
import { validateCanAccessFile } from '../file-privacy'
import { tryParseGraphApiError } from '../parse-graph-api-error'

import {
  clearSessionIdFromRedis,
  getSessionIdFromRedis,
  setSessionIdInRedis,
} from './redis'

async function refreshSessionId(
  tenant: M365TenantInfo,
  fileId: string,
  $: IGlobalVariable,
): Promise<string> {
  const createSessionResponse = await $.http.post<{ id: string }>(
    `/v1.0/sites/${tenant.sharePointSiteId}/drive/items/${fileId}/workbook/createSession`,
    {
      persistChanges: true,
    },
  )
  const sessionId = createSessionResponse.data.id

  await setSessionIdInRedis(tenant, fileId, sessionId)
  return sessionId
}

/**
 * Helper class to ensure we use the same session ID for the same file.
 *
 * Since we serialize operations to the same file across all our workers via
 * BullMQ Pro, this class just stores the session ID in Redis, keyed by the file
 * ID (no synchronization needed).
 *
 * Note that we sync expiry times of the session ID keys in redis (see the
 * SESSION_ID_EXPIRY_SECONDS constant) to the same time period as Microsoft's
 * session inactivity timeout. This saves memory and prevents extraneous
 * retries from "session expired" errors.
 */
export default class WorkbookSession {
  private $: IGlobalVariable

  private tenant: M365TenantInfo
  private fileId: string
  private sessionId: string

  static async acquire(
    $: IGlobalVariable,
    fileId: string,
  ): Promise<WorkbookSession> {
    const authData = extractAuthDataWithPlumberFolder($)

    // We _always_ check against the server in case file sensitivity has changed
    // or it has been moved. This guards against things likes delayed actions
    // working on files whose sensitivity has been upgraded during the delay
    // period.
    await validateCanAccessFile($.user?.email, authData, fileId, $.http)

    const tenant = getM365TenantInfo(authData.tenantKey)
    let sessionId = await getSessionIdFromRedis(tenant, fileId)
    if (!sessionId) {
      sessionId = await refreshSessionId(tenant, fileId, $)
    }

    return new WorkbookSession($, tenant, fileId, sessionId)
  }

  private constructor(
    $: IGlobalVariable,
    tenant: M365TenantInfo,
    fileId: string,
    sessionId: string,
  ) {
    this.$ = $
    this.fileId = fileId
    this.tenant = tenant
    this.sessionId = sessionId
  }

  public async request<T>(
    apiEndpoint: string,
    method: NonNullable<AxiosRequestConfig['method']>,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    try {
      const response = await this.$.http.request<T>({
        ...(config ?? {}),
        url: `/v1.0/sites/${this.tenant.sharePointSiteId}/drive/items/${this.fileId}/workbook${apiEndpoint}`,
        method: method,
        headers: {
          ...(config?.headers ?? {}),
          'workbook-session-id': this.sessionId,
        },
      })

      return response
    } catch (err) {
      if (!(err instanceof HttpError)) {
        throw err
      }

      // Invalidate our current session if Graph API tells us that it's expired
      // or broken.
      //
      // https://learn.microsoft.com/en-us/graph/workbook-error-handling#required-second-level-error-codes

      const graphApiInnerError = tryParseGraphApiError(err)?.innerError?.code
      if (
        !graphApiInnerError ||
        !graphApiInnerError.startsWith('invalidSession')
      ) {
        throw err
      }

      await clearSessionIdFromRedis(this.tenant, this.fileId)

      if (graphApiInnerError === 'invalidSessionReCreatable') {
        // This specific error code means that we can safely retry.
        throw new RetriableError({
          error: 'Excel session needs re-creating',
          delayInMs: 'default',
          delayType: 'step',
        })
      } else {
        // Otherwise, our session was unexpectedly killed by excel servers, so
        // auto-retry should not be done.
        logger.warn('M365 Excel session was unexpectedly invalidated.', {
          event: 'm365-excel-session-invalidated',
          error: graphApiInnerError,
          flowId: this.$.flow?.id,
          stepId: this.$.step?.id,
          executionId: this.$.execution?.id,
        })

        throw err
      }
    }
  }
}

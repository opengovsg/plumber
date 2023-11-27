import type { IGlobalVariable, IJSONObject } from '@plumber/types'

import type { AxiosRequestConfig, AxiosResponse } from 'axios'

import {
  getM365TenantInfo,
  type M365TenantInfo,
} from '@/config/app-env-vars/m365'
import Step from '@/models/step'

import { APP_KEY } from './constants'

interface PerExecutionData extends IJSONObject {
  sessionId: string
  lastExcelStepPosition: number
}

async function createPerExecutionData(
  $: IGlobalVariable,
  tenant: M365TenantInfo,
  fileId: string,
): Promise<PerExecutionData> {
  // TODO: support long lived creation.
  // https://learn.microsoft.com/en-us/graph/api/workbook-createsession?view=graph-rest-1.0&tabs=http#example-1-session-creation-with-long-running-operation-pattern
  const createSessionResponse = await $.http.post<{ id: string }>(
    `/v1.0/sites/${tenant.sharePointSiteId}/drive/items/${fileId}/workbook/createSession`,
    {
      persistChanges: true,
    },
  )

  // In theory, this becomes invalid if the user unpublishes the pipe,
  // edits it, and re-publishes it while an execution is running. But this
  // scenario should be handled by Plumber's overarching action system, not
  // by the app itself.
  const lastExcelStep = await Step.query()
    .where('flow_id', $.flow?.id)
    .andWhere('app_key', APP_KEY)
    .orderBy('position', 'desc')
    .throwIfNotFound()
    .limit(1)
    .first()

  return {
    sessionId: createSessionResponse.data.id,
    lastExcelStepPosition: lastExcelStep.position,
  }
}

export default class WorkbookSession {
  private $: IGlobalVariable

  private tenant: M365TenantInfo
  private fileId: string
  private sessionId: string

  static async create(
    $: IGlobalVariable,
    fileId: string,
  ): Promise<WorkbookSession> {
    const tenant = getM365TenantInfo($.auth.data?.tenantKey as string)
    const { sessionId } = $.execution.appData.get<PerExecutionData>() ?? {}

    // Resume from session set up by a previous step.
    if (sessionId) {
      return new WorkbookSession($, tenant, fileId, sessionId)
    }

    // If we're here, we must be the 1st excel step in the pipe, so spin up a
    // new session
    const perExecutionData = await createPerExecutionData($, tenant, fileId)
    await $.execution.appData.set(perExecutionData)
    return new WorkbookSession($, tenant, fileId, perExecutionData.sessionId)
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
    return await this.$.http.request<T>({
      ...(config ?? {}),
      url: `/v1.0/sites/${this.tenant.sharePointSiteId}/drive/items/${this.fileId}/workbook${apiEndpoint}`,
      method: method,
      headers: {
        ...(config?.headers ?? {}),
        'Workbook-Session-Id': this.sessionId,
      },
    })
  }

  public async closeIfLastExcelStepInPipe(): Promise<void> {
    // Should never be null.
    const { lastExcelStepPosition } =
      this.$.execution.appData.get<PerExecutionData>()

    if (this.$.step?.position === lastExcelStepPosition) {
      await this.request('/closeSession', 'post')
    }
  }
}

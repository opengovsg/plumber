import type { AxiosInstance, AxiosRequestConfig } from 'axios'

export type IHttpClient = AxiosInstance
import type { Request } from 'express'

export type IJSONValue = string | number | boolean | IJSONObject | IJSONArray
export type IJSONArray = Array<IJSONValue>
export interface IJSONObject {
  [x: string]: IJSONValue
}

export interface IConnection {
  id: string
  key: string
  data: string
  formattedData?: IJSONObject
  userId: string
  verified: boolean
  count?: number
  flowCount?: number
  appData?: IApp
  createdAt: string
}

export type TDataOutMetadatumType = 'text' | 'file_url'

/**
 * This should only be defined on _leaf_ nodes (i.e. **array elements** or
 * **object properties**) of your app's `dataOut` object.
 */
export type TDataOutMetadatum = {
  /**
   * Generally defaults to 'text' in the front end if unspecified.
   */
  type?: TDataOutMetadatumType

  /**
   * Generally defaults to `true` in the front end if unspecified.
   */
  isVisible?: boolean

  /**
   * If label is unspecified, the front end will generate one - typically an
   * ugly lodash get string (e.g. "step.abc-def.herp-derp.answer.1").
   */
  label?: string
}

/**
 * Metadata type to use if `dataOut` is an array.
 */
export type TDataOutArrayMetadata = Array<TDataOutMetadatum>

/**
 * Metadata type to use if `dataOut` is an object.
 */
export type TDataOutObjectMetadata = {
  [property: string]:
    | TDataOutMetadatum
    | TDataOutArrayMetadata
    | TDataOutObjectMetadata
}

/**
 * Metadata can be arbitrarily nested objects / arrays as long as
 * leaves / elements are `TDataOutMetadatum`.
 */
export type TDataOutMetadata = TDataOutObjectMetadata | TDataOutArrayMetadata

export interface IExecutionStep {
  id: string
  executionId: string
  stepId: IStep['id']
  step: IStep
  dataIn: IJSONObject
  dataOut: IJSONObject
  dataOutMetadata?: TDataOutMetadata
  errorDetails: IJSONObject
  status: string
  appKey: string
  jobId?: string
  createdAt: string
  updatedAt: string
}

export interface IExecution {
  id: string
  flowId: string
  flow: IFlow
  testRun: boolean
  status: 'success' | 'failure'
  executionSteps: IExecutionStep[]
  updatedAt: string
  createdAt: string
}

export interface IStep {
  id: string
  name?: string
  flowId: string
  key?: string
  appKey?: string
  iconUrl: string
  webhookUrl: string
  type: 'action' | 'trigger'
  connectionId?: string
  status: string
  position: number
  parameters: IJSONObject
  connection?: Partial<IConnection>
  flow: IFlow
  executionSteps: IExecutionStep[]
  // FIXME: remove this property once execution steps are properly exposed via queries
  output?: IJSONObject
  appData?: IApp
  retryable?: boolean
  jobId?: string
}

export interface IFlow {
  id: string
  name: string
  userId: string
  active: boolean
  steps: IStep[]
  createdAt: string
  updatedAt: string
  remoteWebhookId: string
  lastInternalId: () => Promise<string>
}

export interface IUser {
  id: string
  email: string
  connections: IConnection[]
  flows: IFlow[]
  steps: IStep[]
}

export interface IFieldDropdown {
  key: string
  label: string
  type: 'dropdown'
  required: boolean
  allowArbitrary?: boolean
  readOnly?: boolean
  value?: string | boolean
  placeholder?: string | null
  description?: string
  docUrl?: string
  clickToCopy?: boolean
  variables?: boolean
  dependsOn?: string[]
  options?: IFieldDropdownOption[]
  source?: IFieldDropdownSource
}

export interface IFieldDropdownSource {
  type: string
  name: string
  arguments: {
    name: string
    value: string
  }[]
}

export interface IFieldDropdownOption {
  label: string
  value: boolean | string | number
}

export interface IFieldText {
  key: string
  label: string
  type: 'string'
  required?: boolean
  readOnly?: boolean
  value?: string
  placeholder?: string | null
  description?: string
  docUrl?: string
  clickToCopy?: boolean
  variables?: boolean
  dependsOn?: string[]
}

export interface IFieldMultiline {
  key: string
  label: string
  type: 'multiline'
  required?: boolean
  readOnly?: boolean
  value?: string
  placeholder?: string | null
  description?: string
  docUrl?: string
  clickToCopy?: boolean
  variables?: boolean
  dependsOn?: string[]
}

export type IField = IFieldDropdown | IFieldText | IFieldMultiline

export interface IAuthenticationStepField {
  name: string
  value: string | null
  properties?: {
    name: string
    value: string
  }[]
}

export interface IAuthenticationStep {
  type: 'mutation' | 'openWithPopup'
  name: string
  arguments: IAuthenticationStepField[]
}

export interface IDynamicData {
  name: string
  key: string
  run($: IGlobalVariable): Promise<DynamicDataOutput>
}

export interface IApp {
  name: string
  key: string
  iconUrl: string
  docUrl?: string
  authDocUrl: string
  primaryColor: string
  supportsConnections: boolean
  apiBaseUrl: string
  baseUrl: string
  auth?: IAuth
  connectionCount?: number
  flowCount?: number
  beforeRequest?: TBeforeRequest[]
  dynamicData?: IDynamicData[]
  triggers?: ITrigger[]
  actions?: IAction[]
  connections?: IConnection[]

  /**
   * Gets metadata for the data output (i.e. `dataOut`) by an app's execution
   * step.
   *
   * @param stepKey - The key associated with the step.
   * @param executionStep - The execution step to get metadata for.
   */
  getDataOutMetadata?(
    stepKey: IStep['key'],
    executionStep: IExecutionStep,
  ): Promise<TDataOutMetadata>
}

export type TBeforeRequest = {
  ($: IGlobalVariable, requestConfig: AxiosRequestConfig): AxiosRequestConfig
}

export interface DynamicDataOutput {
  data: {
    name: string
    value: string
  }[]
  error?: IJSONObject
}

export interface IAuth {
  generateAuthUrl?($: IGlobalVariable): Promise<void>
  verifyCredentials?($: IGlobalVariable): Promise<void>
  isStillVerified?($: IGlobalVariable): Promise<boolean>
  refreshToken?($: IGlobalVariable): Promise<void>
  verifyWebhook?($: IGlobalVariable): Promise<boolean>
  isRefreshTokenRequested?: boolean
  fields?: IField[]
  authenticationSteps?: IAuthenticationStep[]
  reconnectionSteps?: IAuthenticationStep[]
}

export interface ITriggerOutput {
  data: ITriggerItem[]
  error?: IJSONObject
}

export interface ITriggerItem {
  raw: IJSONObject
  meta: {
    internalId: string
  }
}

export interface IBaseTrigger {
  name: string
  key: string
  type?: 'webhook' | 'polling'
  pollInterval?: number
  description: string
  getInterval?(parameters: IStep['parameters']): string
  run?($: IGlobalVariable): Promise<void>
  testRun?($: IGlobalVariable): Promise<void>
  registerHook?($: IGlobalVariable): Promise<void>
  unregisterHook?($: IGlobalVariable): Promise<void>
  sort?(item: ITriggerItem, nextItem: ITriggerItem): number
}

export interface IRawTrigger extends IBaseTrigger {
  arguments?: IField[]
}

export interface ITrigger extends IBaseTrigger {
  substeps?: ISubstep[]
}

export interface IActionOutput {
  data: IActionItem
  error?: IJSONObject
}

export interface IActionItem {
  raw: IJSONObject
}

export interface IBaseAction {
  name: string
  key: string
  description: string
  run?($: IGlobalVariable): Promise<void>
}

export interface IRawAction extends IBaseAction {
  arguments?: IField[]
}

export interface IAction extends IBaseAction {
  substeps?: ISubstep[]
}

export interface IAuthentication {
  client: unknown
  verifyCredentials(): Promise<IJSONObject>
  isStillVerified(): Promise<boolean>
}

export interface ISubstep {
  key: string
  name: string
  arguments?: IField[]
}

export type IHttpClientParams = {
  $: IGlobalVariable
  baseURL?: string
  beforeRequest?: TBeforeRequest[]
}

export type IGlobalVariable = {
  auth: {
    set: (args: IJSONObject) => Promise<null>
    data: IJSONObject
  }
  app: IApp
  http?: IHttpClient
  request?: IRequest
  flow?: {
    id: string
    remoteWebhookId?: string
    setRemoteWebhookId?: (remoteWebhookId: string) => Promise<void>
  }
  step?: {
    id: string
    appKey: string
    parameters: IJSONObject
  }
  nextStep?: {
    id: string
    appKey: string
    parameters: IJSONObject
  }
  getLastExecutionStep?: () => Promise<IExecutionStep | undefined>
  execution?: {
    id: string
    testRun: boolean
  }
  webhookUrl?: string
  triggerOutput?: ITriggerOutput
  actionOutput?: IActionOutput
  pushTriggerItem?: (triggerItem: ITriggerItem) => Promise<void>
  setActionItem?: (actionItem: IActionItem) => void
}

declare module 'axios' {
  interface AxiosResponse {
    httpError?: IJSONObject
  }

  interface AxiosRequestConfig {
    additionalProperties?: Record<string, unknown>
  }
}

export interface IRequest extends Request {
  rawBody?: Buffer
}

import type {
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios'

// FIXME (ogp-weeloong): temporarily importing these to migrate from IJSON...
// types to type-fest.
import type { JsonArray, JsonObject, JsonPrimitive, JsonValue } from 'type-fest'

import HttpError from '@/errors/http'

export type IHttpClient = AxiosInstance
import type { Request } from 'express'

export type IJSONPrimitive = JsonPrimitive
export type IJSONValue = IJSONPrimitive | IJSONObject | IJSONArray | JsonValue
export type IJSONArray = Array<IJSONValue> | JsonArray
export interface IJSONObject extends JsonObject {
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

export type TDataOutMetadatumType = 'text' | 'file'

/**
 * This should only be defined on _leaf_ nodes (i.e. **primitive array
 * elements** or **object properties**) of your app's `dataOut` object.
 */
export interface IDataOutMetadatum {
  /**
   * Generally defaults to 'text' in the front end if unspecified.
   */
  type?: TDataOutMetadatumType

  /**
   * Generally defaults to `false` in the front end if unspecified.
   */
  isHidden?: boolean

  /**
   * If label is unspecified, the front end will generate one - typically an
   * ugly lodash get string (e.g. "step.abc-def.herp-derp.answer.1").
   */
  label?: string

  /**
   * The value to show to the user, instead of the actual underlying value.
   * Typically used to prettify values (e.g. show the filename of an S3 object
   * instead of the full object key).
   */
  displayedValue?: string

  /**
   * If the front end component renders variables in an ordered list, this
   * specifies the order of the associated variable in that list.
   *
   * **NOTE**: To prevent nullish comparison confusion since this is an
   * optional prop, `order` should be 1-indexed (i.e. its values >= 1).
   *
   * See the implementation of {@link extractVariables} for info on how
   * variables with the same `order` or undefined `order` are sorted.
   */
  order?: number
}

export interface IDataOutMetadata {
  [property: string | number]: IDataOutMetadatum | IDataOutObjectMetadata
}

export interface IExecutionStep {
  id: string
  executionId: string
  stepId: IStep['id']
  step: IStep
  dataIn: IJSONObject
  dataOut: IJSONObject
  errorDetails: IJSONObject
  status: string
  appKey: string
  jobId?: string
  createdAt: string
  updatedAt: string
  metadata: IExecutionStepMetadata

  // Only resolved on the front end via GraphQL.
  dataOutMetadata?: IDataOutMetadata
}

export interface IExecutionStepMetadata {
  isMock: boolean
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

export interface IFlowConfig {
  maxQps?: number
  rejectIfOverMaxQps?: boolean
  errorConfig?: IFlowErrorConfig
}

export interface IFlowErrorConfig {
  notificationFrequency: 'once_per_day' | 'always'
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
  config: IFlowConfig | null
  pendingTransfer?: IFlowTransfer
}

export interface IUser {
  id: string
  email: string
  // TODO: remove these unused properties?
  connections?: IConnection[]
  flows?: IFlow[]
  steps?: IStep[]
}

// Subset of HTML autocomplete values.
type AutoCompleteValue = 'off' | 'url' | 'email'

/**
 * Field Visibility
 */

// This is synced with FieldVisibilityOp GraphQL enum.
// Using jank Extract for now until we get typed GraphQL.
type FieldVisibilityOp = 'always_true' | 'is_empty' | 'equals' | 'not_equals'

interface IFieldVacuousVisibilityCondition {
  op: Extract<FieldVisibilityOp, 'always_true'>
}

interface IFieldKeyOnlyVisibilityCondition {
  op: Extract<FieldVisibilityOp, 'is_empty'>

  fieldKey: string
}

interface IFieldComparativeVisibilityCondition {
  op: Extract<FieldVisibilityOp, 'equals' | 'not_equals'>

  fieldKey: string
  fieldValue: string
}

export type IFieldVisibilityCondition =
  | IFieldComparativeVisibilityCondition
  | IFieldKeyOnlyVisibilityCondition
  | IFieldVacuousVisibilityCondition

/**
 * End field visibility
 */

export interface IBaseField {
  key: string
  label?: string
  type: string
  required?: boolean
  readOnly?: boolean
  placeholder?: string
  description?: string
  docUrl?: string
  clickToCopy?: boolean
  variables?: boolean
  dependsOn?: string[]

  /**
   * Allows hiding a field if other fields' values don't fulfill some condition
   * ---
   * This currently only supports one condition for simplicity, but can be
   * changed to support arbitrary length AND / OR conditionals using a 2-level
   * nested array: top level represents OR, inner level represents AND (similar
   * to if-then).
   *
   * NOTE: This currently only checks fields within the same object / "sibling"
   * fields (e.g. for MultiRow, where fields are inside an array, `fieldKey`
   * cannot reference fields outside the array. Nor can it refefence fields in
   * other array elements).
   */
  hiddenIf?: IFieldVisibilityCondition
}

export interface IFieldDropdown extends IBaseField {
  type: 'dropdown'
  showOptionValue?: boolean
  allowArbitrary?: boolean
  value?: string | boolean
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

  /**
   * Set `showOptionValue` to false if you do not want this to be shown in the
   * dropdown. The value will also not be rendered if `description` if
   * specified.
   */
  value: boolean | string | number

  /**
   * If this is specified, this will be rendered instead of `value`. Note that
   * this is always rendered if specified, even if `showOptionValue` is set to
   * false.
   */
  description?: string
}

export interface IFieldText extends IBaseField {
  type: 'string'
  value?: string

  // Not applicable if field has variables.
  autoComplete?: AutoCompleteValue
}

export interface IFieldMultiline extends IBaseField {
  type: 'multiline'
  value?: string

  // Not applicable if field has variables.
  autoComplete?: AutoCompleteValue
}

export interface IFieldMultiSelect extends IBaseField {
  type: 'multiselect'
  value?: string

  variableTypes?: TDataOutMetadatumType[]
}

export interface IFieldMultiRow extends IBaseField {
  type: 'multirow'
  value?: string

  subFields: IField[]
}

export interface IFieldRichText extends IBaseField {
  type: 'rich-text'
  value?: string
}

export type IField =
  | IFieldDropdown
  | IFieldText
  | IFieldMultiline
  | IFieldMultiSelect
  | IFieldMultiRow
  | IFieldRichText

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
  description?: string
  isNewApp?: boolean

  /**
   * A callback that is invoked if there's an error for any HTTP request this
   * app makes using $.http.
   *
   * This is useful to perform per-request monitoring or error transformations
   * (e.g logging on specific HTTP response codes or converting 429s to a
   * non-HttpError to prevent automated retries).
   *
   * We support this because if an app needs custom error monitoring for _all_
   * requests, it allows us to stop having to remember to surround all our code
   * with try / catch.
   */
  requestErrorHandler?: TRequestErrorHandler
  getTransferDetails?($: IGlobalVariable): Promise<ITransferDetails> // TODO (mal): add null if necessary, check with Stacey
}

export type TBeforeRequest = (
  $: IGlobalVariable,
  requestConfig: InternalAxiosRequestConfig,
) => Promise<InternalAxiosRequestConfig>

export type TRequestErrorHandler = (
  $: IGlobalVariable,
  error: HttpError,
) => Promise<void>

export interface DynamicDataOutput {
  data: {
    name: string
    value: string
  }[]
  error?: IJSONObject
}

export type AuthConnectionType = 'user-added' | 'system-added'
export type ConnectionRegistrationType = 'global' | 'per-step'

interface IBaseAuth {
  connectionType: AuthConnectionType

  generateAuthUrl?($: IGlobalVariable): Promise<void>
  verifyCredentials?($: IGlobalVariable): Promise<void>
  isStillVerified?($: IGlobalVariable): Promise<boolean>
  refreshToken?($: IGlobalVariable): Promise<void>
  verifyWebhook?($: IGlobalVariable): Promise<boolean>
  isRefreshTokenRequested?: boolean
  authenticationSteps?: IAuthenticationStep[]
  reconnectionSteps?: IAuthenticationStep[]

  connectionRegistrationType?: ConnectionRegistrationType
  registerConnection?($: IGlobalVariable): Promise<void>
  unregisterConnection?($: IGlobalVariable): Promise<void>
  verifyConnectionRegistration?(
    $: IGlobalVariable,
  ): Promise<IVerifyConnectionRegistrationOutput>
}

interface IUserAddedConnectionAuth extends IBaseAuth {
  connectionType: 'user-added'
  fields?: IField[]
}

interface ISystemAddedConnectionAuth extends IBaseAuth {
  connectionType: 'system-added'
  getSystemAddedConnections?(user: IUser): Promise<IConnection[]>
}

export type IAuth = IUserAddedConnectionAuth | ISystemAddedConnectionAuth

export interface ITriggerOutput {
  data: ITriggerItem[]
  error?: IJSONObject
}

export interface ITriggerItem {
  raw: IJSONObject
  meta: {
    internalId: string
  }
  isMock?: boolean
}

export type ITriggerInstructions = Partial<{
  beforeUrlMsg: string
  afterUrlMsg: string
  hideWebhookUrl: boolean
  errorMsg: string
  mockDataMsg: string
}>

// TODO (mal): instructions is temporarily used to display no connection but to modify for phase 2
export type ITransferDetails = {
  position: number
  appName: string
  connectionName?: string // could be no connection
  instructions?: string
}

export interface IBaseTrigger {
  name: string
  key: string
  type?: 'webhook' | 'polling'
  pollInterval?: number
  description: string
  webhookTriggerInstructions?: ITriggerInstructions
  getInterval?(parameters: IStep['parameters']): string
  run?($: IGlobalVariable): Promise<void>
  testRun?($: IGlobalVariable): Promise<void>
  sort?(item: ITriggerItem, nextItem: ITriggerItem): number

  /**
   * Gets metadata for the `dataOut` of this trigger's execution step.
   *
   * We pass in `executionStep` instead of `executionStep.dataOut` in case other
   * info (e.g. initial params via `executionStep.step.parameters`) is needed.
   *
   * @param executionStep The execution step to get metadata for.
   */
  getDataOutMetadata?(executionStep: IExecutionStep): Promise<IDataOutMetadata>
}

export interface IRawTrigger extends IBaseTrigger {
  arguments?: IField[]
}

export interface ITrigger extends IBaseTrigger {
  substeps?: ISubstep[]
}

interface PostmanSendEmailMetadata {
  type: 'postman-send-email'
  progress?: number
}
// Can add more type in this union later for different action types
export type NextStepMetadata = PostmanSendEmailMetadata
export interface IActionRunResult {
  /**
   * This enables actions to control pipe execution flow. This is for actions
   * that need to redirect pipe execution (e.g. if-then).
   *
   * If this is not set, or is falsey, pipe execution continues as per normal
   * (i.e. next step is step with position + 1).
   */
  nextStep?:
    | { command: 'jump-to-step'; stepId: IStep['id'] }
    | { command: 'stop-execution' }
  nextStepMetadata?: NextStepMetadata
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
  run?(
    $: IGlobalVariable,
    metadata?: NextStepMetadata,
  ): Promise<IActionRunResult | void>
  testRun?(
    $: IGlobalVariable,
    metadata?: NextStepMetadata,
  ): Promise<IActionRunResult | void>

  /**
   * Gets metadata for the `dataOut` of this action's execution step.
   *
   * We pass in `executionStep` instead of `executionStep.dataOut` in case other
   * info (e.g. initial params via `executionStep.step.parameters`) is needed.
   *
   * @param executionStep The execution step to get metadata for.
   */
  getDataOutMetadata?(executionStep: IExecutionStep): Promise<IDataOutMetadata>

  /**
   * Preprocess variables before substituting them into the action's parameters.
   *
   * Useful for cases where variables needs to be escaped in some way before substitution.
   */
  preprocessVariable?(parameterKey: string, variableValue: unknown): unknown

  /**
   * For optimizing our S3 storage; we won't store files into our S3 unless
   * the pipe has at least 1 action which processes files.
   */
  doesFileProcessing?(step: Step): boolean

  /**
   * Specifies if this action "groups" steps after it, and only allows adding
   * later steps in nested modal (e.g. if-then).
   *
   * If true, the front end will not render the "add step" button after this
   * action.
   */
  groupsLaterSteps?: boolean
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
  beforeRequest: TBeforeRequest[]
  requestErrorHandler: TRequestErrorHandler
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
    hasFileProcessingActions: boolean
    userId: string
    remoteWebhookId?: string
    setRemoteWebhookId?: (remoteWebhookId: string) => Promise<void>
  }
  step?: {
    id: string
    appKey: string
    position: number
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

  /**
   * If this is non-null, it contains details of the pipe owner if this is
   * accessed in a situation where there is a pipe (e.g. inside an action, or
   * if someone is is editing a pipe on our front end).
   *
   * Otherwise, it contains details of the user who is currently using our
   * front end (e.g. when they are testing connections).
   *
   * NOTE: If we implement collaborator functionality in the future, user may
   * not imply pipe owner. But until we implement it, user === pipe owner
   * always.
   */
  user?: IUser
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

export interface IVerifyConnectionRegistrationOutput {
  registrationVerified: boolean
  message: string
}

export interface ITestConnectionOutput
  extends Partial<IVerifyConnectionRegistrationOutput> {
  connectionVerified: boolean
}
export interface IStepError {
  name: string
  solution: string
  position: number
  appName: string
  details?: IJSONObject
}

// Tiles
export interface ITableColumnConfig {
  width?: number
}

export interface ITableColumnMetadata {
  id: string
  name: string
  position: number
  config: ITableColumnConfig
}

export interface ITableMetadata {
  id: string
  name: string
  columns: ITableColumnMetadata[]
  lastAccessedAt: string
  viewOnlyKey?: string
}

export interface ITableRow {
  rowId: string
  data: Record<string, IJSONPrimitive>
}

export type ITableCollabRole = 'owner' | 'editor' | 'viewer'

// Flow transfers
export type IFlowTransferStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'

export interface IFlowTransfer {
  id: string
  flowId: string
  oldOwnerId: string
  newOwnerId: string
  status: IFlowTransferStatus
  oldOwner: IUser
  newOwner: IUser
  flow: IFlow
}

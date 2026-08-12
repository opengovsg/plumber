import type {
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios'

// FIXME (ogp-weeloong): temporarily importing these to migrate from IJSON...
// types to type-fest.
import type { JsonArray, JsonObject, JsonPrimitive, JsonValue } from 'type-fest'

import type { JobsProOptions, WorkerProOptions } from '@taskforcesh/bullmq-pro'
import type { RelatedQueryBuilder } from 'objection'

import HttpError from '@/errors/http'

export type IHttpClient = AxiosInstance
import type { Request } from 'express'

export type IJSONPrimitive = JsonPrimitive
export type IJSONValue = IJSONPrimitive | IJSONObject | IJSONArray | JsonValue
export type IJSONArray = Array<IJSONValue> | JsonArray
export interface IJSONObject extends JsonObject {
  [x: string]: IJSONValue
}

export interface SetupMessage {
  /**
   * Synced with SetupMessageVariant GraphQL enum. Loosely based off Design
   * System's InfoBox variants
   */
  variant: 'info' | 'warning'

  /**
   * Supports markdown
   */
  messageBody: string
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
  description?: string
}

/**
 * 'array' is currently used only in formSG checkbox field but
 * will be extended to for-each feature handling
 */
export type TDataOutMetadatumType =
  | 'text'
  | 'file'
  | 'array'
  | 'tile_row_id'
  | 'table'
  | 'approval'
  | 'ai_response'
  | 'html'
  | 'email'

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
   * NOTE: used to hide columns in the variables list, specifically for 'table' object
   * we still need them in the dataOut to compare parameters against the last test execution
   * at the for-each step
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

  /**
   * Indicates whether this field should only be shown when the user expands
   * the "Show more" section in the variable list.
   */
  isCollapsedByDefault?: boolean

  /**
   * Is hidden from the variable list but variable is still displayed properly if
   * already in use. For e.g. this is used to preserve the old `sgidUinFin` variable
   * but we dont want to show to UIN/FIN variables in variable list
   */
  isHiddenFromList?: boolean
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
  status: 'success' | 'failure'
  appKey: string
  jobId?: string
  createdAt: string
  updatedAt: string
  metadata: IExecutionStepMetadata
  key: string

  // Only resolved on the front end via GraphQL.
  dataOutMetadata?: IDataOutMetadata
}

export interface IExecutionStepMetadata {
  isMock?: boolean
  lastTestSubmissionDate?: string
  iteration?: number
  iterations?: number
  iterationStatus?: Record<
    string,
    'success' | 'failure' | 'partial-success' | null
  >
  isLastIteration?: boolean
  isLastStep?: boolean
}

export interface IExecution {
  id: string
  flowId: string
  flow: IFlow
  testRun: boolean
  status: 'success' | 'failure' | null
  executionSteps: IExecutionStep[]
  updatedAt: string
  createdAt: string
}

export type IStepApprovalBranch = 'approve' | 'reject'

export interface IStepApprovalConfig {
  branch: 'reject'
  stepId: string
}

export interface IStepConfig {
  stepName?: string
  approval?: IStepApprovalConfig
  // Id of the last step (inclusive) inside an if-then V2 block, absent on
  // if-then V1 steps. System-owned like `approval`, set only by the backend
  // and never surfaced in the step form.
  endStepId?: string
  templateConfig?: IStepTemplateConfig
  adminOverride?: IJSONObject
}

export interface IStepTemplateConfig {
  appEventKey?: string
  customTemplate?: string
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
  config: IStepConfig
  // FIXME: remove this property once execution steps are properly exposed via queries
  output?: IJSONObject
  appData?: IApp
  retryable?: boolean
  jobId?: string
  createdAt: string
}

export interface IFlowConfig {
  maxQps?: number
  rejectIfOverMaxQps?: boolean
  errorConfig?: IFlowErrorConfig
  duplicateCount?: number
  templateConfig?: IFlowTemplateConfig
  attachments?: IFlowAttachmentsConfig[]
  // AI Builder config
  aiBuilderConfig?: {
    traceId: string // trace id on Rome (Langfuse)
  }
  isForceClogged?: boolean
  // Set to true to prevent the archival job from archiving executions for this
  // flow. Absence (undefined) means archiving is enabled. Used by the
  // rehydration CLI to protect restored executions from same-night re-archival;
  // clear with: UPDATE flows SET config = config - 'archiveDisabled' WHERE id = '<id>'
  archiveDisabled?: true
}

export type NotificationRecipients = 'editor' | 'viewer'
export interface IFlowErrorConfig {
  notificationFrequency: 'once_per_day' | 'always'
  notificationRecipients: NotificationRecipients[]
}

export interface IFlowTemplateConfig {
  templateId: string
  formId?: string
  tileId?: string
}

export interface IFlowAttachmentsConfig {
  name: string
  displayedValue: string
  value: string
  size: number
  updatedAt: string
}

export type IFlowCollabRole = 'owner' | 'editor' | 'viewer'

export interface IFlowCollaborator {
  email?: string // Populated by GraphQL resolver
  role: IFlowCollabRole
  user?: IUser
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
  template?: ITemplate
  collaborators?: IFlowCollaborator[]
  role?: string
}

export interface IUser {
  id: string
  email: string
  createdAt: string
  updatedAt: string
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
  fieldValue?: IJSONPrimitive
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
  tooltipText?: string

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

  /**
   * Allows hiding a field from the AI Builder chat only, while still showing
   * it in the pipe editor. Shares the same condition shape as `hiddenIf`,
   * but only `always_true` is currently evaluated by the MCP server (which
   * has no runtime sibling-field values to check other conditions against).
   */
  hiddenFromAiIf?: IFieldVisibilityCondition

  // message to show when no variables are available
  noVariablesMessage?: string

  /**
   * Allows setting a default value for the field.
   * ---
   * Can be either:
   * - A static string value that is always used
   * - A dynamic object that determines the default based on another field's value
   * ---
   * Static example:
   * defaultValue: 'Default text here'
   *
   * Dynamic example:
   * {
   *   fieldKey: 'promptType',
   *   options: {
   *     analyse: 'Analyse this document',
   *     categorise: 'Categorise this document',
   *     summarise: 'Summarise this document',
   *     write: 'Write this document',
   *   },
   * }
   */
  defaultValue?:
    | string
    | {
        fieldKey: string
        options: Record<string, string | IJSONValue>
      }
}

export type DropdownAddNewType = 'modal' | 'inline'

export interface IFieldDropdown extends IBaseField {
  type: 'dropdown'
  showOptionValue?: boolean
  allowArbitrary?: boolean
  isSearchable?: boolean
  addNewOption?: {
    id: DropdownAddNewId // identifier when add new option is selected
    type: DropdownAddNewType
    label: string
  }
  clickableLink?: {
    label: string
    url: string // use {value} to replace the value in the url
  }
  value?: string // for true/false dropdown, use boolean-radio
  options?: IFieldDropdownOption[]
  source?: IFieldDropdownSource
  variableTypes?: TDataOutMetadatumType[]
}

export type DropdownAddNewId =
  | 'tiles-createTileRow-tableId'
  | 'tiles-createTileRow-columnId'
  | 'databricks-createTable'
  | 'databricks-createTableColumn'

export interface IFieldDropdownSource {
  type: string
  name: string
  arguments: {
    name: string
    value: string
  }[]
}

/**
 * Referenced by name rather than by component because the field schema is
 * serialised to JSON over /api/apps; the frontend maps each name back.
 */
export type TFieldDropdownOptionIcon = 'text' | 'hash' | 'list-ol'

export interface IFieldDropdownOption {
  label: string

  /**
   * Set `showOptionValue` to false if you do not want this to be shown in the
   * dropdown. The value will also not be rendered if `description` if
   * specified.
   */
  value: string | number

  /**
   * If this is specified, this will be rendered instead of `value`. Note that
   * this is always rendered if specified, even if `showOptionValue` is set to
   * false.
   */
  description?: string

  icon?: TFieldDropdownOptionIcon
}

export interface IFieldText extends IBaseField {
  type: 'string'
  value?: string
  variableTypes?: TDataOutMetadatumType[]

  // Not applicable if field has variables.
  autoComplete?: AutoCompleteValue

  // To only allow selection of one variable
  singleVariableSelection?: boolean
}

export interface IFieldAttachment extends IBaseField {
  type: 'attachment'
  value?: string
  variableTypes?: TDataOutMetadatumType[]

  // Only for attachments
  maxFiles?: number
  disableUpload?: boolean
}

export interface IFieldMultiline extends IBaseField {
  type: 'multiline'
  value?: string
  variableTypes?: TDataOutMetadatumType[]

  // Not applicable if field has variables.
  autoComplete?: AutoCompleteValue

  // To only allow selection of one variable
  singleVariableSelection?: boolean
}

export interface IFieldMultiSelect extends IBaseField {
  type: 'multiselect'
  value?: string

  variableTypes?: TDataOutMetadatumType[]
}

type IFieldMultiRowMultiColSubField = IField & {
  customStyle?: Record<string, string | number>
}

export interface IFieldMultiRowMultiCol extends IBaseField {
  type: 'multirow-multicol'
  value?: string
  addRowButtonText?: string
  subFields: IFieldMultiRowMultiColSubField[]
  maxRows?: number
  /**
   * Opt-in for the "Autofill" button, which bulk-replaces rows with one row
   * per option from subFields[0]'s dynamic-data source. Only sensible when
   * every option from that source should get its own row (e.g. "set a value
   * for every field/column") — not for filter/lookup-style fields where a
   * user picks a handful of specific conditions.
   */
  autofillable?: boolean
  /**
   * When `autofillable` is set, hides the "Autofill" button if subFields[0]'s
   * dynamic-data source has more options than this. Use when autofilling a
   * very large number of rows would be unwieldy for the user (or the app).
   */
  maxAutofillOptions?: number
}

export interface IFieldMultiRow extends IBaseField {
  type: 'multirow'
  value?: string
  addRowButtonText?: string

  subFields: IField[]
  maxRows?: number
}

/**
 * Generic "OR of AND" builder: an array of groups, each holding AND-ed rows.
 * Persisted shape is `[{ rows: [row, ...] }, ...]` (outer = OR, inner = AND).
 * It is agnostic to its rows — `subFields` describe a single row, exactly like
 * `multirow-multicol`. `maxGroups` / `maxRowsPerGroup` are soft caps (the UI
 * disables the add buttons at the limit; the backend re-checks them).
 */
export interface IFieldGroupedMultiRow extends IBaseField {
  type: 'grouped-multirow'
  value?: string
  subFields: IField[]
  maxGroups?: number
  maxRowsPerGroup?: number
  addRowButtonText?: string
  addGroupButtonText?: string
}

/**
 * Marks a rich-text field as previewable in a kind-specific modal in
 * FlowStepTestController. Keep this union narrow; expand only as new preview
 * kinds (e.g. 'sms') ship.
 */
export type TFieldPreviewType = 'email'

export type TRteMenuOption =
  | 'Bold'
  | 'Italic'
  | 'Underline'
  | 'LinkSet'
  | 'LinkRemove'
  | 'Heading1'
  | 'Heading2'
  | 'Heading3'
  | 'Heading4'
  | 'ListBullet'
  | 'ListOrdered'
  | 'ImageAdd'
  | 'TableAdd'
  | 'ColumnAdd'
  | 'ColumnRemove'
  | 'RowAdd'
  | 'RowRemove'
  | 'FormatClear'
  | 'Undo'
  | 'Redo'
  | 'Divider'

export interface IFieldRichText extends IBaseField {
  type: 'rich-text'
  value?: string
  variableTypes?: TDataOutMetadatumType[]

  // Enables table variable insertion with preview and column selection
  // When true, table variables will be rendered as TableVariablePill in the editor
  supportTableDisplay?: boolean
  presets?: IPreset[]

  // Specifies the order and what menu options to show in the RTE
  // 'Divider' is specified manually to determine when a divider should be shown
  customRteMenuOptions?: TRteMenuOption[]

  /**
   * If set, renders a kind-specific Preview button at the end of the
   * RichTextEditor toolbar that previews the editor's live HTML.
   */
  previewType?: TFieldPreviewType
}

/**
 * A selectable preset shown beside rich-text inputs.
 *
 * Selecting a preset applies one or more field assignments to sibling fields
 * in the same form scope (e.g. `prompt`, `responseFields`).
 */
export interface IPreset {
  key: string
  label: string
  description: string
  assignments: IPresetAssignment[]
}

/**
 * A single field update applied when a preset is selected.
 *
 * `fieldKey` is relative to the current form scope/base path.
 */
export interface IPresetAssignment {
  fieldKey: string
  value: IJSONValue
}

export interface IFieldDragDrop extends IBaseField {
  type: 'dragdrop'
  value?: string

  // Not applicable if field has variables.
  autoComplete?: AutoCompleteValue
}

export interface IFieldBooleanRadio extends IBaseField {
  type: 'boolean-radio'
  value?: boolean // will default to null if not provided
  options?: IFieldBooleanRadioOptions // only can provide 2 OPTIONS if label is not yes/no
}

export type IFieldBooleanRadioOptions = [
  IFieldBooleanRadioOption,
  IFieldBooleanRadioOption,
]

export interface IFieldBooleanRadioOption {
  label: string
  description?: string
  value: boolean
}

export type IField =
  | IFieldDropdown
  | IFieldText
  | IFieldAttachment
  | IFieldMultiline
  | IFieldMultiRowMultiCol
  | IFieldMultiSelect
  | IFieldMultiRow
  | IFieldGroupedMultiRow
  | IFieldRichText
  | IFieldBooleanRadio
  | IFieldDragDrop

/**
 * A single condition row, as evaluated by the toolbox `conditionIsTrue` helper.
 * The row shape is unchanged from the original flat condition format; `text` is
 * the legacy name for the comparison "value".
 */
export interface IConditionRow {
  field: IJSONValue
  is: 'is' | 'not'
  condition: string // existing operator union
  text: IJSONValue // legacy name for "value"
}

/**
 * Generic group shape used by the `grouped-multirow` builder: an outer OR of
 * inner AND-ed `rows`. Generic over the row type so the structure can be reused
 * across apps (the inner key is always the neutral `rows`).
 */
export interface IMultiRowGroup<TRow = IJSONObject> {
  rows: TRow[]
}

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

export interface IDynamicAction {
  name: string
  key: string
  type: 'action'
  run($: IGlobalVariable): Promise<IJSONObject>
}

export interface IAppQueue {
  /**
   * Obtains the group config for a job that is about to be enqueued to this
   * app's queue.
   *
   * @see {@link JobsProOptions.group}
   */
  getGroupConfigForJob?(
    jobData: IActionJobData,
  ): Promise<JobsProOptions['group']>

  /**
   * Set per-group concurrency or rate limits. This is mutually exclusive
   * because BullMQ Pro does not support using both together.
   *
   * @see {@link WorkerProOptions.group}
   */
  groupLimits?:
    | {
        type: 'concurrency'
        concurrency: WorkerProOptions['group']['concurrency']
      }
    | {
        type: 'rate-limit'
        limit: WorkerProOptions['group']['limit']
      }

  /**
   * Set rate limit for the entire queue (applied before groups' limits)
   */
  queueRateLimit?: WorkerProOptions['limiter']

  /**
   * Configures if we are allowed to delay or rate limit the entire queue.
   *
   * Concretely speaking, if this is true, RetriableErrors with delayType set
   * to `queue` will pause the entire queue for the delay period via a call to
   * `worker.rateLimit()`.
   *
   * This is a safety mechanism to ensure that we don't accidentally delay
   * queues if reused code / helper functions throw RetriableErrors with
   * `delayType` == `queue`.
   *
   * Note that BullMQ allows delaying the entire queue only if a queue rate
   * limit is set. Thus, if you configure this to true, you must also configure
   * the queueRateLimit.
   */
  isQueueDelayable: boolean

  /**
   * The type of worker to use for this queue.
   */
  workerType: 'action' | 'sub-trigger'
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
  dynamicData?: (IDynamicData | IDynamicAction)[]
  triggers?: ITrigger[]
  actions?: IAction[]
  connections?: IConnection[]
  description?: string
  isNewApp?: boolean
  demoVideoDetails?: DemoVideoDetails
  category?: AppCategory

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

  /**
   * Apps specify this if they need their own dedicated action queue.
   */
  queue?: IAppQueue

  /**
   * Apps specify this if they want to display an additional informative
   * message to the user during pipe setup / config, when the user selects the
   * app in the "choose app and event" substep.
   *
   * Note that the apps' own triggers / actions may also specify their own
   * setupMessage. In this case, the triggers' / actions' info message takes
   * precedence.
   */
  setupMessage?: SetupMessage

  /**
   * Optional versioned step parameter transformer for an app.
   *
   * Both functions must be provided together — use `createVersionedStepTransformer`
   * from `@/helpers/transform-step-parameters` which returns them as a coupled pair.
   *
   * Enables zero-downtime parameter format migrations by transforming legacy
   * parameters to the current format when steps are fetched or executed.
   *
   * `transformStepParameters` — called on every step fetch (afterFind hook); applies
   * all migrations from `stepVersion` onwards.
   *
   * `getLatestStepVersion` — used when creating new steps so they start at the
   * latest version and require no transformation.
   */
  stepTransformer?: {
    transformStepParameters: (
      stepKey: string,
      stepParameters: IJSONObject,
      stepVersion: number,
    ) => IJSONObject
    getLatestStepVersion: (stepKey: string) => number
  }
}

export type AppCategory = 'data' | 'communication' | 'logic' | 'others' | 'ai'

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
    type?: 'string' | 'number' | 'null' | 'email'
  }[]
  error?: IJSONObject
}

export type AuthConnectionType = 'user-added' | 'system-added'
export type ConnectionRegistrationType = 'global' | 'per-step'

type IConnectionModalLabel = {
  chooseConnectionLabel?: string
  addConnectionLabel?: string
}

export interface SubtriggerData {
  type: 'mrf'
  mrfStepId: string
}

interface IBaseAuth {
  connectionType: AuthConnectionType

  generateAuthUrl?($: IGlobalVariable): Promise<void>
  verifyCredentials?($: IGlobalVariable): Promise<void>
  isStillVerified?($: IGlobalVariable): Promise<boolean>
  refreshToken?($: IGlobalVariable): Promise<void>
  verifyWebhook?($: IGlobalVariable): Promise<{
    verified: boolean
    internalId: string | null
    isSubtrigger?: boolean
    subtriggerData?: SubtriggerData
  }>
  isRefreshTokenRequested?: boolean
  authenticationSteps?: IAuthenticationStep[]
  reconnectionSteps?: IAuthenticationStep[]

  connectionRegistrationType?: ConnectionRegistrationType
  registerConnection?($: IGlobalVariable): Promise<void>
  unregisterConnection?($: IGlobalVariable): Promise<void>
  verifyConnectionRegistration?(
    $: IGlobalVariable,
  ): Promise<IVerifyConnectionRegistrationOutput>
  connectionModalLabel?: IConnectionModalLabel
  autoCheckStep?: boolean
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
    [key: string]: unknown
  }
}

export type ITriggerInstructions = Partial<{
  beforeUrlMsg: string
  afterUrlMsg: string
  hideWebhookUrl: boolean
  errorMsg: string
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
  isNew?: boolean
  webhookTriggerInstructions?: ITriggerInstructions
  hiddenFromUser?: boolean
  getInterval?(parameters: IStep['parameters']): string
  run?($: IGlobalVariable): Promise<void>
  testRun?(
    $: IGlobalVariable,
    testRunMetadata?: TestRunStepMetadata,
  ): Promise<void>
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

  /**
   * Triggers specify this if they want to display an additional informative
   * message to the user during pipe setup / config.
   */
  setupMessage?: SetupMessage

  // link that is used in the infobox. meant for new actions / triggers
  linkToGuide?: string

  // if true, the trigger does not require authentication
  noAuthRequired?: boolean
}

export interface IRawTrigger extends IBaseTrigger {
  arguments?: IField[]
}

export interface ITrigger extends IBaseTrigger {
  substeps?: ISubstep[]
}

// Can add more type in this union later for different action types
export type NextStepMetadata = Record<string, any>
export type TestRunStepMetadata = Record<string, any>

export interface IActionJobData {
  flowId: string
  executionId: string
  stepId: string
  metadata?: NextStepMetadata
  /**
   * Timestamp of the most recent retry (manual, via retryExecutionStep, or
   * automatic, via exponentialBackoffWithJitter) that made this job eligible
   * to run again, so queue-timing telemetry measures from that retry instead
   * of the job's original (potentially very stale) enqueue time.
   */
  retryTimestamp?: number
}

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
    // "stop-execution" works differently from "pause-execution"
    // for "pause-execution", the execution is paused and the execution status is not patched
    // for "stop-execution", the execution is ended and the execution status is patched
    | { command: 'pause-execution' }
    | { command: 'stop-execution' }
    | { command: 'start-for-each'; stepId: IStep['id'] }
  nextStepMetadata?: NextStepMetadata
}

export interface IActionOutput {
  data: IActionItem
  error?: IJSONObject
}

export interface IActionItem {
  raw: IJSONObject
  meta?: IExecutionStepMetadata
}

export interface IBaseAction {
  name: string
  key: string
  // can only be created by backend, not by user
  hiddenFromUser?: boolean
  description: string
  isNew?: boolean
  run?(
    $: IGlobalVariable,
    metadata?: NextStepMetadata,
  ): Promise<IActionRunResult | void>
  testRun?(
    $: IGlobalVariable,
    testRunMetadata?: TestRunStepMetadata,
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

  /**
   * Actions specify this if they want to display an additional informative
   * message to the user during pipe setup / config.
   */
  setupMessage?: SetupMessage

  /**
   * Validates the step parameters to ensure that it is valid.
   * Used when saving the step.
   */
  validateStepParameters?: (parameters: IJSONObject) => void

  // link that is used in the infobox. meant for new actions / triggers
  linkToGuide?: string

  // if true, the action does not require authentication
  noAuthRequired?: boolean
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
    connectionId?: string
  }
  app: IApp
  http?: IHttpClient
  request?: IRequest
  flow?: {
    id: string
    name: string
    hasFileProcessingActions: boolean
    userId: string
    remoteWebhookId?: string
    setRemoteWebhookId?: (remoteWebhookId: string) => Promise<void>
    isActive: boolean
  }
  step?: {
    id: string
    appKey: string
    key: string
    position: number
    parameters: IJSONObject
    version: number
  }
  nextStep?: {
    id: string
    appKey: string
    parameters: IJSONObject
  }
  getLastExecutionStep?: (
    options?: Partial<{
      sameExecution: boolean
      testRunOnly: boolean
      additionalFilter?: (
        qb: RelatedQueryBuilder<ExecutionStep, ExecutionStep>,
      ) => void
      iteration?: number
    }>,
  ) => Promise<IExecutionStep | undefined>
  execution?: {
    id: string
    testRun: boolean
  }
  metadata?: IJSONObject
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
  details?: IJSONObject
  partialRetry?: {
    buttonMessage: string
  }
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
  databaseType: DatabaseType
  columns: ITableColumnMetadata[]
  lastAccessedAt: string
  viewOnlyKey?: string
  collaborators?: ITableCollaborator[]
  isPasswordProtected: boolean
  role?: ITableCollabRole
}

export interface ITableCollaborator {
  email: string
  role: ITableCollabRole
}

export interface ITableRowCsv {
  rowId: string
  data: string
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

// Templates
export interface ITemplate {
  id: string
  name: string
  description: string
  steps: ITemplateStep[]
  iconName?: string // demo templates have no icons
  tags?: TemplateTagType[]
  tileTemplateData?: TileTemplateData
  demoVideoDetails?: DemoVideoDetails
}

// demo template or for empty flows state
export type TemplateTagType = 'demo' | 'empty' | 'new'

export interface ITemplateStep {
  position: number // primary key, no need id for now
  appKey?: string
  eventKey?: string
  sampleUrl?: string // specific to template e.g. form or tile link
  sampleUrlDescription?: string // differs for each step e.g. view a sample form
  parameters?: IJSONObject
}

// This is for creation of tile for a template
export type TileTemplateData = {
  name: string
  columns: string[]
  rowData?: IJSONObject[]
}

export type DemoVideoDetails = {
  url: string
  title: string
}

export interface CustomGraphQLFormattedError {
  message: string
  code: string
  data?: IJSONObject
}

/**
 * AI Builder step types — represent a parsed workflow configuration produced by
 * the chat stream, before it is persisted as real IStep records.
 *
 * Not derived via Pick from IBaseTrigger/IBaseAction (app definitions with run/testRun/sort)
 * or IStep (persisted DB model with id/flowId/status), because neither shape overlaps
 * meaningfully with what the AI builder needs.
 */
export interface IFlowStepsTrigger {
  type: 'trigger'
  appKey: string
  key: string
  description: string
}

export interface IFlowStepsAction {
  type: 'action'
  appKey: string
  key: string
  description: string
  config: {
    stepName: string
    templateConfig?: Record<string, string>
  }
  parameters?: { depth: 0; branchName: string }
}

export interface IFlowSteps {
  name: string
  trigger: IFlowStepsTrigger
  actions: IFlowStepsAction[]
  traceId?: string
}

// ── MCP Bridge API types ────────────────────────────────────────────────────

export interface IMcpAppField {
  key: string
  label: string
  type: string
  description?: string
  required: boolean
  options?: IMcpFieldOption[]
  isDynamic?: boolean
  dynamicDataKey?: string
  dynamicDataParameters?: Record<string, string>
  subFields?: IMcpAppField[]
}

export interface IMcpAppAction {
  key: string
  name: string
  description?: string
  fields: IMcpAppField[]
}

export interface IMcpApp {
  key: string
  name: string
  requiresConnection: boolean
  triggers: IMcpAppAction[]
  actions: IMcpAppAction[]
}

export interface IMcpStepDetail {
  id: string
  position: number
  appKey: string
  key: string
  type: 'trigger' | 'action'
  /** Configured parameter values — never contains connection credentials */
  parameters: Record<string, unknown>
}

export interface IMcpPipeSummary {
  id: string
  name: string
  active: boolean
  stepCount: number
  createdAt: string
  updatedAt: string
}

export interface IMcpPipeDetail extends IMcpPipeSummary {
  steps: IMcpStepDetail[]
}

export interface IMcpExecution {
  id: string
  pipeId: string
  status: 'success' | 'failure' | null
  testRun: boolean
  createdAt: string
  updatedAt: string
}

export interface IMcpVerifyResponse {
  userId: string
  email: string
}

export interface IMcpConnection {
  id: string
  appKey: string
  label: string
  verified: boolean
}

export interface IMcpFieldOption {
  label: string
  value: string
}


export interface IMcpIncompleteStep {
  stepId: string
  position: number
  appKey: string | null
  missingFields: Array<{ key: string; label: string }>
  missingConnection: boolean
}

export interface IMcpActivateError {
  isError: true
  incompleteSteps: IMcpIncompleteStep[]
}

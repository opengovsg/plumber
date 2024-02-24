/* eslint-disable */
import type { JsonObject } from 'type-fest';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** The `JSONObject` scalar type represents JSON objects as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSONObject: { input: JsonObject; output: JsonObject; }
};

export type Action = {
  __typename?: 'Action';
  description?: Maybe<Scalars['String']['output']>;
  groupsLaterSteps?: Maybe<Scalars['Boolean']['output']>;
  key?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  substeps?: Maybe<Array<Maybe<ActionSubstep>>>;
};

export type ActionSubstep = {
  __typename?: 'ActionSubstep';
  arguments?: Maybe<Array<Maybe<ActionSubstepArgument>>>;
  key?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
};

export type ActionSubstepArgument = {
  __typename?: 'ActionSubstepArgument';
  allowArbitrary?: Maybe<Scalars['Boolean']['output']>;
  dependsOn?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  description?: Maybe<Scalars['String']['output']>;
  hidden?: Maybe<Scalars['Boolean']['output']>;
  key?: Maybe<Scalars['String']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  options?: Maybe<Array<Maybe<ArgumentOption>>>;
  placeholder?: Maybe<Scalars['String']['output']>;
  required?: Maybe<Scalars['Boolean']['output']>;
  showOptionValue?: Maybe<Scalars['Boolean']['output']>;
  source?: Maybe<ActionSubstepArgumentSource>;
  subFields?: Maybe<Array<Maybe<ActionSubstepArgument>>>;
  type?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['JSONObject']['output']>;
  variableTypes?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  variables?: Maybe<Scalars['Boolean']['output']>;
};

export type ActionSubstepArgumentSource = {
  __typename?: 'ActionSubstepArgumentSource';
  arguments?: Maybe<Array<Maybe<ActionSubstepArgumentSourceArgument>>>;
  name?: Maybe<Scalars['String']['output']>;
  type?: Maybe<Scalars['String']['output']>;
};

export type ActionSubstepArgumentSourceArgument = {
  __typename?: 'ActionSubstepArgumentSourceArgument';
  name?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

export type App = {
  __typename?: 'App';
  actions?: Maybe<Array<Maybe<Action>>>;
  auth?: Maybe<AppAuth>;
  authDocUrl?: Maybe<Scalars['String']['output']>;
  connectionCount?: Maybe<Scalars['Int']['output']>;
  connections?: Maybe<Array<Maybe<Connection>>>;
  description?: Maybe<Scalars['String']['output']>;
  docUrl?: Maybe<Scalars['String']['output']>;
  flowCount?: Maybe<Scalars['Int']['output']>;
  iconUrl?: Maybe<Scalars['String']['output']>;
  key?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  primaryColor?: Maybe<Scalars['String']['output']>;
  triggers?: Maybe<Array<Maybe<Trigger>>>;
};

export type AppAuth = {
  __typename?: 'AppAuth';
  authenticationSteps?: Maybe<Array<Maybe<AuthenticationStep>>>;
  connectionRegistrationType?: Maybe<Scalars['String']['output']>;
  connectionType: Scalars['String']['output'];
  fields?: Maybe<Array<Maybe<Field>>>;
  reconnectionSteps?: Maybe<Array<Maybe<ReconnectionStep>>>;
};

export type AppHealth = {
  __typename?: 'AppHealth';
  version?: Maybe<Scalars['String']['output']>;
};

export enum ArgumentEnumType {
  Integer = 'integer',
  String = 'string'
}

export type ArgumentOption = {
  __typename?: 'ArgumentOption';
  label?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['JSONObject']['output']>;
};

export type AuthLink = {
  __typename?: 'AuthLink';
  url?: Maybe<Scalars['String']['output']>;
};

export type AuthenticationStep = {
  __typename?: 'AuthenticationStep';
  arguments?: Maybe<Array<Maybe<AuthenticationStepArgument>>>;
  name?: Maybe<Scalars['String']['output']>;
  type?: Maybe<Scalars['String']['output']>;
};

export type AuthenticationStepArgument = {
  __typename?: 'AuthenticationStepArgument';
  name?: Maybe<Scalars['String']['output']>;
  properties?: Maybe<Array<Maybe<AuthenticationStepProperty>>>;
  type?: Maybe<ArgumentEnumType>;
  value?: Maybe<Scalars['String']['output']>;
};

export type AuthenticationStepProperty = {
  __typename?: 'AuthenticationStepProperty';
  name?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

export type Connection = {
  __typename?: 'Connection';
  app?: Maybe<App>;
  createdAt?: Maybe<Scalars['String']['output']>;
  flowCount?: Maybe<Scalars['Int']['output']>;
  formattedData?: Maybe<ConnectionData>;
  id?: Maybe<Scalars['String']['output']>;
  key?: Maybe<Scalars['String']['output']>;
  verified?: Maybe<Scalars['Boolean']['output']>;
};

export type ConnectionData = {
  __typename?: 'ConnectionData';
  screenName?: Maybe<Scalars['String']['output']>;
};

export type CreateConnectionInput = {
  formattedData: Scalars['JSONObject']['input'];
  key: Scalars['String']['input'];
};

export type CreateFlowInput = {
  connectionId?: InputMaybe<Scalars['String']['input']>;
  triggerAppKey?: InputMaybe<Scalars['String']['input']>;
};

export type CreateStepInput = {
  appKey?: InputMaybe<Scalars['String']['input']>;
  connection?: InputMaybe<StepConnectionInput>;
  flow?: InputMaybe<StepFlowInput>;
  id?: InputMaybe<Scalars['String']['input']>;
  key?: InputMaybe<Scalars['String']['input']>;
  parameters?: InputMaybe<Scalars['JSONObject']['input']>;
  previousStep?: InputMaybe<PreviousStepInput>;
  previousStepId?: InputMaybe<Scalars['String']['input']>;
};

export type CreateTableInput = {
  name: Scalars['String']['input'];
};

export type CreateTableRowInput = {
  data: Scalars['JSONObject']['input'];
  tableId: Scalars['ID']['input'];
};

export type CreateTableRowsInput = {
  dataArray: Array<Scalars['JSONObject']['input']>;
  tableId: Scalars['ID']['input'];
};

export type DeleteConnectionInput = {
  id: Scalars['String']['input'];
};

export type DeleteFlowInput = {
  id: Scalars['String']['input'];
};

export type DeleteStepInput = {
  ids: Array<Scalars['String']['input']>;
};

export type DeleteTableInput = {
  id: Scalars['ID']['input'];
};

export type DeleteTableRowsInput = {
  rowIds: Array<Scalars['ID']['input']>;
  tableId: Scalars['ID']['input'];
};

export type ExecuteFlowInput = {
  stepId: Scalars['String']['input'];
};

export type ExecuteFlowType = {
  __typename?: 'ExecuteFlowType';
  data?: Maybe<Scalars['JSONObject']['output']>;
  step?: Maybe<Step>;
};

export type Execution = {
  __typename?: 'Execution';
  createdAt?: Maybe<Scalars['String']['output']>;
  flow?: Maybe<Flow>;
  id?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  testRun?: Maybe<Scalars['Boolean']['output']>;
  updatedAt?: Maybe<Scalars['String']['output']>;
};

export type ExecutionConnection = {
  __typename?: 'ExecutionConnection';
  edges?: Maybe<Array<Maybe<ExecutionEdge>>>;
  pageInfo?: Maybe<PageInfo>;
};

export type ExecutionEdge = {
  __typename?: 'ExecutionEdge';
  node?: Maybe<Execution>;
};

export type ExecutionStep = {
  __typename?: 'ExecutionStep';
  appKey?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  dataIn?: Maybe<Scalars['JSONObject']['output']>;
  dataOut?: Maybe<Scalars['JSONObject']['output']>;
  dataOutMetadata?: Maybe<Scalars['JSONObject']['output']>;
  errorDetails?: Maybe<Scalars['JSONObject']['output']>;
  executionId?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  jobId?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  step?: Maybe<Step>;
  stepId?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['String']['output']>;
};

export type ExecutionStepConnection = {
  __typename?: 'ExecutionStepConnection';
  edges?: Maybe<Array<Maybe<ExecutionStepEdge>>>;
  pageInfo?: Maybe<PageInfo>;
};

export type ExecutionStepEdge = {
  __typename?: 'ExecutionStepEdge';
  node?: Maybe<ExecutionStep>;
};

export type Field = {
  __typename?: 'Field';
  allowArbitrary?: Maybe<Scalars['Boolean']['output']>;
  autoComplete?: Maybe<Scalars['String']['output']>;
  clickToCopy?: Maybe<Scalars['Boolean']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  docUrl?: Maybe<Scalars['String']['output']>;
  key?: Maybe<Scalars['String']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  options?: Maybe<Array<Maybe<ArgumentOption>>>;
  placeholder?: Maybe<Scalars['String']['output']>;
  readOnly?: Maybe<Scalars['Boolean']['output']>;
  required?: Maybe<Scalars['Boolean']['output']>;
  showOptionValue?: Maybe<Scalars['Boolean']['output']>;
  type?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

export type Flow = {
  __typename?: 'Flow';
  active?: Maybe<Scalars['Boolean']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  steps?: Maybe<Array<Maybe<Step>>>;
  updatedAt?: Maybe<Scalars['String']['output']>;
};

export type FlowConnection = {
  __typename?: 'FlowConnection';
  edges?: Maybe<Array<Maybe<FlowEdge>>>;
  pageInfo?: Maybe<PageInfo>;
};

export type FlowEdge = {
  __typename?: 'FlowEdge';
  node?: Maybe<Flow>;
};

export type GenerateAuthUrlInput = {
  id: Scalars['String']['input'];
};

export type LoginWithSelectedSgidInput = {
  workEmail: Scalars['String']['input'];
};

export type LoginWithSelectedSgidResult = {
  __typename?: 'LoginWithSelectedSgidResult';
  success: Scalars['Boolean']['output'];
};

export type LoginWithSgidInput = {
  authCode: Scalars['String']['input'];
  nonce: Scalars['String']['input'];
  verifier: Scalars['String']['input'];
};

export type LoginWithSgidResult = {
  __typename?: 'LoginWithSgidResult';
  publicOfficerEmployments: Array<SgidPublicOfficerEmployment>;
};

export type Mutation = {
  __typename?: 'Mutation';
  createConnection?: Maybe<Connection>;
  createFlow?: Maybe<Flow>;
  createRow: Scalars['ID']['output'];
  createRows?: Maybe<Scalars['Boolean']['output']>;
  createShareableTableLink: Scalars['String']['output'];
  createStep?: Maybe<Step>;
  createTable: TableMetadata;
  deleteConnection?: Maybe<Scalars['Boolean']['output']>;
  deleteFlow?: Maybe<Scalars['Boolean']['output']>;
  deleteRows: Array<Scalars['ID']['output']>;
  deleteStep?: Maybe<Flow>;
  deleteTable: Scalars['Boolean']['output'];
  executeFlow?: Maybe<ExecuteFlowType>;
  generateAuthUrl?: Maybe<AuthLink>;
  loginWithSelectedSgid: LoginWithSelectedSgidResult;
  loginWithSgid: LoginWithSgidResult;
  logout?: Maybe<Scalars['Boolean']['output']>;
  registerConnection?: Maybe<Scalars['Boolean']['output']>;
  requestOtp?: Maybe<Scalars['Boolean']['output']>;
  resetConnection?: Maybe<Connection>;
  retryExecutionStep?: Maybe<Scalars['Boolean']['output']>;
  updateConnection?: Maybe<Connection>;
  updateFlow?: Maybe<Flow>;
  updateFlowStatus?: Maybe<Flow>;
  updateRow: Scalars['ID']['output'];
  updateStep?: Maybe<Step>;
  updateTable: TableMetadata;
  verifyConnection?: Maybe<Connection>;
  verifyOtp?: Maybe<Scalars['Boolean']['output']>;
};


export type MutationCreateConnectionArgs = {
  input?: InputMaybe<CreateConnectionInput>;
};


export type MutationCreateFlowArgs = {
  input?: InputMaybe<CreateFlowInput>;
};


export type MutationCreateRowArgs = {
  input: CreateTableRowInput;
};


export type MutationCreateRowsArgs = {
  input: CreateTableRowsInput;
};


export type MutationCreateShareableTableLinkArgs = {
  tableId: Scalars['ID']['input'];
};


export type MutationCreateStepArgs = {
  input?: InputMaybe<CreateStepInput>;
};


export type MutationCreateTableArgs = {
  input: CreateTableInput;
};


export type MutationDeleteConnectionArgs = {
  input?: InputMaybe<DeleteConnectionInput>;
};


export type MutationDeleteFlowArgs = {
  input?: InputMaybe<DeleteFlowInput>;
};


export type MutationDeleteRowsArgs = {
  input: DeleteTableRowsInput;
};


export type MutationDeleteStepArgs = {
  input?: InputMaybe<DeleteStepInput>;
};


export type MutationDeleteTableArgs = {
  input: DeleteTableInput;
};


export type MutationExecuteFlowArgs = {
  input?: InputMaybe<ExecuteFlowInput>;
};


export type MutationGenerateAuthUrlArgs = {
  input?: InputMaybe<GenerateAuthUrlInput>;
};


export type MutationLoginWithSelectedSgidArgs = {
  input: LoginWithSelectedSgidInput;
};


export type MutationLoginWithSgidArgs = {
  input: LoginWithSgidInput;
};


export type MutationRegisterConnectionArgs = {
  input?: InputMaybe<RegisterConnectionInput>;
};


export type MutationRequestOtpArgs = {
  input?: InputMaybe<RequestOtpInput>;
};


export type MutationResetConnectionArgs = {
  input?: InputMaybe<ResetConnectionInput>;
};


export type MutationRetryExecutionStepArgs = {
  input?: InputMaybe<RetryExecutionStepInput>;
};


export type MutationUpdateConnectionArgs = {
  input?: InputMaybe<UpdateConnectionInput>;
};


export type MutationUpdateFlowArgs = {
  input?: InputMaybe<UpdateFlowInput>;
};


export type MutationUpdateFlowStatusArgs = {
  input?: InputMaybe<UpdateFlowStatusInput>;
};


export type MutationUpdateRowArgs = {
  input: UpdateTableRowInput;
};


export type MutationUpdateStepArgs = {
  input?: InputMaybe<UpdateStepInput>;
};


export type MutationUpdateTableArgs = {
  input: UpdateTableInput;
};


export type MutationVerifyConnectionArgs = {
  input?: InputMaybe<VerifyConnectionInput>;
};


export type MutationVerifyOtpArgs = {
  input?: InputMaybe<VerifyOtpInput>;
};

export type PageInfo = {
  __typename?: 'PageInfo';
  currentPage: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
};

export type PreviousStepInput = {
  id?: InputMaybe<Scalars['String']['input']>;
};

export type Query = {
  __typename?: 'Query';
  getAllRows: Array<TileRow>;
  getApp?: Maybe<App>;
  getApps?: Maybe<Array<Maybe<App>>>;
  getConnectedApps?: Maybe<Array<Maybe<App>>>;
  getCurrentUser?: Maybe<User>;
  getDynamicData?: Maybe<Array<Maybe<Scalars['JSONObject']['output']>>>;
  getExecution?: Maybe<Execution>;
  getExecutionSteps?: Maybe<ExecutionStepConnection>;
  getExecutions?: Maybe<ExecutionConnection>;
  getFlow?: Maybe<Flow>;
  getFlows?: Maybe<FlowConnection>;
  getStepWithTestExecutions?: Maybe<Array<Maybe<Step>>>;
  getTable: TableMetadata;
  getTables: Array<TableMetadata>;
  healthcheck?: Maybe<AppHealth>;
  testConnection?: Maybe<TestConnectionResult>;
};


export type QueryGetAllRowsArgs = {
  tableId: Scalars['String']['input'];
};


export type QueryGetAppArgs = {
  key: Scalars['String']['input'];
};


export type QueryGetAppsArgs = {
  name?: InputMaybe<Scalars['String']['input']>;
  onlyWithActions?: InputMaybe<Scalars['Boolean']['input']>;
  onlyWithTriggers?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryGetConnectedAppsArgs = {
  name?: InputMaybe<Scalars['String']['input']>;
};


export type QueryGetDynamicDataArgs = {
  key: Scalars['String']['input'];
  parameters?: InputMaybe<Scalars['JSONObject']['input']>;
  stepId: Scalars['String']['input'];
};


export type QueryGetExecutionArgs = {
  executionId: Scalars['String']['input'];
};


export type QueryGetExecutionStepsArgs = {
  executionId: Scalars['String']['input'];
  limit: Scalars['Int']['input'];
  offset: Scalars['Int']['input'];
};


export type QueryGetExecutionsArgs = {
  limit: Scalars['Int']['input'];
  offset: Scalars['Int']['input'];
  searchInput?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
};


export type QueryGetFlowArgs = {
  id: Scalars['String']['input'];
};


export type QueryGetFlowsArgs = {
  appKey?: InputMaybe<Scalars['String']['input']>;
  connectionId?: InputMaybe<Scalars['String']['input']>;
  limit: Scalars['Int']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  offset: Scalars['Int']['input'];
};


export type QueryGetStepWithTestExecutionsArgs = {
  stepId: Scalars['String']['input'];
};


export type QueryGetTableArgs = {
  tableId: Scalars['String']['input'];
};


export type QueryTestConnectionArgs = {
  connectionId: Scalars['String']['input'];
  stepId?: InputMaybe<Scalars['String']['input']>;
};

export type ReconnectionStep = {
  __typename?: 'ReconnectionStep';
  arguments?: Maybe<Array<Maybe<ReconnectionStepArgument>>>;
  name?: Maybe<Scalars['String']['output']>;
  type?: Maybe<Scalars['String']['output']>;
};

export type ReconnectionStepArgument = {
  __typename?: 'ReconnectionStepArgument';
  name?: Maybe<Scalars['String']['output']>;
  properties?: Maybe<Array<Maybe<ReconnectionStepProperty>>>;
  type?: Maybe<ArgumentEnumType>;
  value?: Maybe<Scalars['String']['output']>;
};

export type ReconnectionStepProperty = {
  __typename?: 'ReconnectionStepProperty';
  name?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

export type RegisterConnectionInput = {
  connectionId: Scalars['String']['input'];
  stepId?: InputMaybe<Scalars['String']['input']>;
};

export type RequestOtpInput = {
  email: Scalars['String']['input'];
};

export type ResetConnectionInput = {
  id: Scalars['String']['input'];
};

export type RetryExecutionStepInput = {
  executionStepId: Scalars['String']['input'];
};

export type SgidPublicOfficerEmployment = {
  __typename?: 'SgidPublicOfficerEmployment';
  agencyName?: Maybe<Scalars['String']['output']>;
  departmentName?: Maybe<Scalars['String']['output']>;
  employmentTitle?: Maybe<Scalars['String']['output']>;
  employmentType?: Maybe<Scalars['String']['output']>;
  workEmail?: Maybe<Scalars['String']['output']>;
};

export type Step = {
  __typename?: 'Step';
  appKey?: Maybe<Scalars['String']['output']>;
  connection?: Maybe<Connection>;
  executionSteps?: Maybe<Array<Maybe<ExecutionStep>>>;
  flow?: Maybe<Flow>;
  iconUrl?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  key?: Maybe<Scalars['String']['output']>;
  parameters?: Maybe<Scalars['JSONObject']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  previousStepId?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  type?: Maybe<StepEnumType>;
  webhookUrl?: Maybe<Scalars['String']['output']>;
};

export type StepConnectionInput = {
  id?: InputMaybe<Scalars['String']['input']>;
};

export enum StepEnumType {
  Action = 'action',
  Trigger = 'trigger'
}

export type StepFlowInput = {
  id?: InputMaybe<Scalars['String']['input']>;
};

export type StepInput = {
  appKey?: InputMaybe<Scalars['String']['input']>;
  connection?: InputMaybe<StepConnectionInput>;
  flow?: InputMaybe<StepFlowInput>;
  id?: InputMaybe<Scalars['String']['input']>;
  key?: InputMaybe<Scalars['String']['input']>;
  parameters?: InputMaybe<Scalars['JSONObject']['input']>;
  previousStep?: InputMaybe<PreviousStepInput>;
  previousStepId?: InputMaybe<Scalars['String']['input']>;
};

export type TableColumnConfig = {
  __typename?: 'TableColumnConfig';
  width?: Maybe<Scalars['Int']['output']>;
};

export type TableColumnConfigInput = {
  width?: InputMaybe<Scalars['Int']['input']>;
};

export type TableColumnMetadata = {
  __typename?: 'TableColumnMetadata';
  config: TableColumnConfig;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  position: Scalars['Int']['output'];
};

export type TableColumnMetadataInput = {
  config?: InputMaybe<TableColumnConfigInput>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
};

export type TableMetadata = {
  __typename?: 'TableMetadata';
  columns?: Maybe<Array<TableColumnMetadata>>;
  id: Scalars['ID']['output'];
  lastAccessedAt: Scalars['String']['output'];
  name: Scalars['String']['output'];
  viewOnlyKey?: Maybe<Scalars['String']['output']>;
};

export type TestConnectionResult = {
  __typename?: 'TestConnectionResult';
  connectionVerified: Scalars['Boolean']['output'];
  message?: Maybe<Scalars['String']['output']>;
  registrationVerified?: Maybe<Scalars['Boolean']['output']>;
};

export type TileRow = {
  __typename?: 'TileRow';
  data: Scalars['JSONObject']['output'];
  rowId: Scalars['ID']['output'];
};

export type Trigger = {
  __typename?: 'Trigger';
  description?: Maybe<Scalars['String']['output']>;
  key?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  pollInterval?: Maybe<Scalars['Int']['output']>;
  substeps?: Maybe<Array<Maybe<TriggerSubstep>>>;
  type?: Maybe<Scalars['String']['output']>;
  webhookTriggerInstructions?: Maybe<TriggerInstructions>;
};

export type TriggerInstructions = {
  __typename?: 'TriggerInstructions';
  afterUrlMsg?: Maybe<Scalars['String']['output']>;
  beforeUrlMsg?: Maybe<Scalars['String']['output']>;
  errorMsg?: Maybe<Scalars['String']['output']>;
  hideWebhookUrl?: Maybe<Scalars['Boolean']['output']>;
};

export type TriggerSubstep = {
  __typename?: 'TriggerSubstep';
  arguments?: Maybe<Array<Maybe<TriggerSubstepArgument>>>;
  key?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
};

export type TriggerSubstepArgument = {
  __typename?: 'TriggerSubstepArgument';
  allowArbitrary?: Maybe<Scalars['Boolean']['output']>;
  dependsOn?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  description?: Maybe<Scalars['String']['output']>;
  key?: Maybe<Scalars['String']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  options?: Maybe<Array<Maybe<ArgumentOption>>>;
  placeholder?: Maybe<Scalars['String']['output']>;
  required?: Maybe<Scalars['Boolean']['output']>;
  showOptionValue?: Maybe<Scalars['Boolean']['output']>;
  source?: Maybe<TriggerSubstepArgumentSource>;
  subFields?: Maybe<Array<Maybe<TriggerSubstepArgument>>>;
  type?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['JSONObject']['output']>;
  variableTypes?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  variables?: Maybe<Scalars['Boolean']['output']>;
};

export type TriggerSubstepArgumentSource = {
  __typename?: 'TriggerSubstepArgumentSource';
  arguments?: Maybe<Array<Maybe<TriggerSubstepArgumentSourceArgument>>>;
  name?: Maybe<Scalars['String']['output']>;
  type?: Maybe<Scalars['String']['output']>;
};

export type TriggerSubstepArgumentSourceArgument = {
  __typename?: 'TriggerSubstepArgumentSourceArgument';
  name?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

export type UpdateConnectionInput = {
  formattedData: Scalars['JSONObject']['input'];
  id: Scalars['String']['input'];
};

export type UpdateFlowInput = {
  id: Scalars['String']['input'];
  name: Scalars['String']['input'];
};

export type UpdateFlowStatusInput = {
  active: Scalars['Boolean']['input'];
  id: Scalars['String']['input'];
};

export type UpdateStepInput = {
  appKey?: InputMaybe<Scalars['String']['input']>;
  connection?: InputMaybe<StepConnectionInput>;
  flow?: InputMaybe<StepFlowInput>;
  id?: InputMaybe<Scalars['String']['input']>;
  key?: InputMaybe<Scalars['String']['input']>;
  parameters?: InputMaybe<Scalars['JSONObject']['input']>;
  previousStep?: InputMaybe<PreviousStepInput>;
  previousStepId?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateTableInput = {
  addedColumns?: InputMaybe<Array<Scalars['String']['input']>>;
  deletedColumns?: InputMaybe<Array<Scalars['ID']['input']>>;
  id: Scalars['ID']['input'];
  modifiedColumns?: InputMaybe<Array<TableColumnMetadataInput>>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateTableRowInput = {
  data: Scalars['JSONObject']['input'];
  rowId: Scalars['ID']['input'];
  tableId: Scalars['ID']['input'];
};

export type User = {
  __typename?: 'User';
  createdAt?: Maybe<Scalars['String']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['String']['output']>;
};

export type VerifyConnectionInput = {
  id: Scalars['String']['input'];
};

export type VerifyOtpInput = {
  email: Scalars['String']['input'];
  otp: Scalars['String']['input'];
};

export type CreateConnectionMutationVariables = Exact<{
  input?: InputMaybe<CreateConnectionInput>;
}>;


export type CreateConnectionMutation = { __typename?: 'Mutation', createConnection?: { __typename?: 'Connection', id?: string | null, key?: string | null, verified?: boolean | null, formattedData?: { __typename?: 'ConnectionData', screenName?: string | null } | null } | null };

export type CreateFlowMutationVariables = Exact<{
  input?: InputMaybe<CreateFlowInput>;
}>;


export type CreateFlowMutation = { __typename?: 'Mutation', createFlow?: { __typename?: 'Flow', id?: string | null, name?: string | null } | null };

export type CreateRowMutationVariables = Exact<{
  input: CreateTableRowInput;
}>;


export type CreateRowMutation = { __typename?: 'Mutation', createRow: string };

export type CreateRowsMutationVariables = Exact<{
  input: CreateTableRowsInput;
}>;


export type CreateRowsMutation = { __typename?: 'Mutation', createRows?: boolean | null };

export type CreateShareableTableLinkMutationVariables = Exact<{
  tableId: Scalars['ID']['input'];
}>;


export type CreateShareableTableLinkMutation = { __typename?: 'Mutation', createShareableTableLink: string };

export type CreateStepMutationVariables = Exact<{
  input?: InputMaybe<CreateStepInput>;
}>;


export type CreateStepMutation = { __typename?: 'Mutation', createStep?: { __typename?: 'Step', id?: string | null, type?: StepEnumType | null, key?: string | null, appKey?: string | null, parameters?: JsonObject | null, position?: number | null, status?: string | null, connection?: { __typename?: 'Connection', id?: string | null } | null } | null };

export type CreateTableMutationVariables = Exact<{
  input: CreateTableInput;
}>;


export type CreateTableMutation = { __typename?: 'Mutation', createTable: { __typename?: 'TableMetadata', id: string, name: string } };

export type DeleteConnectionMutationVariables = Exact<{
  input?: InputMaybe<DeleteConnectionInput>;
}>;


export type DeleteConnectionMutation = { __typename?: 'Mutation', deleteConnection?: boolean | null };

export type DeleteFlowMutationVariables = Exact<{
  input?: InputMaybe<DeleteFlowInput>;
}>;


export type DeleteFlowMutation = { __typename?: 'Mutation', deleteFlow?: boolean | null };

export type DeleteRowsMutationVariables = Exact<{
  input: DeleteTableRowsInput;
}>;


export type DeleteRowsMutation = { __typename?: 'Mutation', deleteRows: Array<string> };

export type DeleteStepMutationVariables = Exact<{
  input?: InputMaybe<DeleteStepInput>;
}>;


export type DeleteStepMutation = { __typename?: 'Mutation', deleteStep?: { __typename?: 'Flow', id?: string | null, steps?: Array<{ __typename?: 'Step', id?: string | null } | null> | null } | null };

export type DeleteTableMutationVariables = Exact<{
  input: DeleteTableInput;
}>;


export type DeleteTableMutation = { __typename?: 'Mutation', deleteTable: boolean };

export type ExecuteFlowMutationVariables = Exact<{
  input?: InputMaybe<ExecuteFlowInput>;
}>;


export type ExecuteFlowMutation = { __typename?: 'Mutation', executeFlow?: { __typename?: 'ExecuteFlowType', data?: JsonObject | null, step?: { __typename?: 'Step', id?: string | null, status?: string | null, appKey?: string | null, executionSteps?: Array<{ __typename?: 'ExecutionStep', id?: string | null, executionId?: string | null, stepId?: string | null, status?: string | null, dataOut?: JsonObject | null, dataOutMetadata?: JsonObject | null } | null> | null } | null } | null };

export type GenerateAuthUrlMutationVariables = Exact<{
  input?: InputMaybe<GenerateAuthUrlInput>;
}>;


export type GenerateAuthUrlMutation = { __typename?: 'Mutation', generateAuthUrl?: { __typename?: 'AuthLink', url?: string | null } | null };

export type LoginWithSelectedSgidMutationVariables = Exact<{
  input: LoginWithSelectedSgidInput;
}>;


export type LoginWithSelectedSgidMutation = { __typename?: 'Mutation', loginWithSelectedSgid: { __typename?: 'LoginWithSelectedSgidResult', success: boolean } };

export type LoginWithSgidMutationVariables = Exact<{
  input: LoginWithSgidInput;
}>;


export type LoginWithSgidMutation = { __typename?: 'Mutation', loginWithSgid: { __typename?: 'LoginWithSgidResult', publicOfficerEmployments: Array<{ __typename?: 'SgidPublicOfficerEmployment', workEmail?: string | null, agencyName?: string | null, departmentName?: string | null, employmentTitle?: string | null }> } };

export type LogoutMutationVariables = Exact<{ [key: string]: never; }>;


export type LogoutMutation = { __typename?: 'Mutation', logout?: boolean | null };

export type RegisterConnectionMutationVariables = Exact<{
  input?: InputMaybe<RegisterConnectionInput>;
}>;


export type RegisterConnectionMutation = { __typename?: 'Mutation', registerConnection?: boolean | null };

export type RequestOtpMutationVariables = Exact<{
  input?: InputMaybe<RequestOtpInput>;
}>;


export type RequestOtpMutation = { __typename?: 'Mutation', requestOtp?: boolean | null };

export type ResetConnectionMutationVariables = Exact<{
  input?: InputMaybe<ResetConnectionInput>;
}>;


export type ResetConnectionMutation = { __typename?: 'Mutation', resetConnection?: { __typename?: 'Connection', id?: string | null } | null };

export type RetryExecutionStepMutationVariables = Exact<{
  input?: InputMaybe<RetryExecutionStepInput>;
}>;


export type RetryExecutionStepMutation = { __typename?: 'Mutation', retryExecutionStep?: boolean | null };

export type UpdateConnectionMutationVariables = Exact<{
  input?: InputMaybe<UpdateConnectionInput>;
}>;


export type UpdateConnectionMutation = { __typename?: 'Mutation', updateConnection?: { __typename?: 'Connection', id?: string | null, key?: string | null, verified?: boolean | null, formattedData?: { __typename?: 'ConnectionData', screenName?: string | null } | null } | null };

export type UpdateFlowStatusMutationVariables = Exact<{
  input?: InputMaybe<UpdateFlowStatusInput>;
}>;


export type UpdateFlowStatusMutation = { __typename?: 'Mutation', updateFlowStatus?: { __typename?: 'Flow', id?: string | null, active?: boolean | null } | null };

export type UpdateFlowMutationVariables = Exact<{
  input?: InputMaybe<UpdateFlowInput>;
}>;


export type UpdateFlowMutation = { __typename?: 'Mutation', updateFlow?: { __typename?: 'Flow', id?: string | null, name?: string | null } | null };

export type UpdateRowMutationVariables = Exact<{
  input: UpdateTableRowInput;
}>;


export type UpdateRowMutation = { __typename?: 'Mutation', updateRow: string };

export type UpdateStepMutationVariables = Exact<{
  input?: InputMaybe<UpdateStepInput>;
}>;


export type UpdateStepMutation = { __typename?: 'Mutation', updateStep?: { __typename?: 'Step', id?: string | null, type?: StepEnumType | null, key?: string | null, appKey?: string | null, webhookUrl?: string | null, parameters?: JsonObject | null, status?: string | null, connection?: { __typename?: 'Connection', id?: string | null } | null } | null };

export type UpdateTableMutationVariables = Exact<{
  input: UpdateTableInput;
}>;


export type UpdateTableMutation = { __typename?: 'Mutation', updateTable: { __typename?: 'TableMetadata', id: string } };

export type VerifyConnectionMutationVariables = Exact<{
  input?: InputMaybe<VerifyConnectionInput>;
}>;


export type VerifyConnectionMutation = { __typename?: 'Mutation', verifyConnection?: { __typename?: 'Connection', id?: string | null, key?: string | null, verified?: boolean | null, createdAt?: string | null, formattedData?: { __typename?: 'ConnectionData', screenName?: string | null } | null, app?: { __typename?: 'App', key?: string | null } | null } | null };

export type VerifyOtpMutationVariables = Exact<{
  input?: InputMaybe<VerifyOtpInput>;
}>;


export type VerifyOtpMutation = { __typename?: 'Mutation', verifyOtp?: boolean | null };

export type GetAllRowsQueryVariables = Exact<{
  tableId: Scalars['String']['input'];
}>;


export type GetAllRowsQuery = { __typename?: 'Query', getAllRows: Array<{ __typename?: 'TileRow', rowId: string, data: JsonObject }> };

export type GetAppConnectionsQueryVariables = Exact<{
  key: Scalars['String']['input'];
}>;


export type GetAppConnectionsQuery = { __typename?: 'Query', getApp?: { __typename?: 'App', key?: string | null, connections?: Array<{ __typename?: 'Connection', id?: string | null, key?: string | null, verified?: boolean | null, flowCount?: number | null, createdAt?: string | null, formattedData?: { __typename?: 'ConnectionData', screenName?: string | null } | null } | null> | null } | null };

export type GetAppQueryVariables = Exact<{
  key: Scalars['String']['input'];
}>;


export type GetAppQuery = { __typename?: 'Query', getApp?: { __typename?: 'App', name?: string | null, key?: string | null, iconUrl?: string | null, docUrl?: string | null, authDocUrl?: string | null, primaryColor?: string | null, auth?: { __typename?: 'AppAuth', connectionType: string, connectionRegistrationType?: string | null, fields?: Array<{ __typename?: 'Field', key?: string | null, label?: string | null, type?: string | null, required?: boolean | null, readOnly?: boolean | null, value?: string | null, description?: string | null, docUrl?: string | null, allowArbitrary?: boolean | null, clickToCopy?: boolean | null, autoComplete?: string | null, options?: Array<{ __typename?: 'ArgumentOption', label?: string | null, value?: JsonObject | null } | null> | null } | null> | null, authenticationSteps?: Array<{ __typename?: 'AuthenticationStep', type?: string | null, name?: string | null, arguments?: Array<{ __typename?: 'AuthenticationStepArgument', name?: string | null, value?: string | null, type?: ArgumentEnumType | null, properties?: Array<{ __typename?: 'AuthenticationStepProperty', name?: string | null, value?: string | null } | null> | null } | null> | null } | null> | null, reconnectionSteps?: Array<{ __typename?: 'ReconnectionStep', type?: string | null, name?: string | null, arguments?: Array<{ __typename?: 'ReconnectionStepArgument', name?: string | null, value?: string | null, type?: ArgumentEnumType | null, properties?: Array<{ __typename?: 'ReconnectionStepProperty', name?: string | null, value?: string | null } | null> | null } | null> | null } | null> | null } | null, connections?: Array<{ __typename?: 'Connection', id?: string | null } | null> | null, triggers?: Array<{ __typename?: 'Trigger', name?: string | null, key?: string | null, type?: string | null, pollInterval?: number | null, description?: string | null, substeps?: Array<{ __typename?: 'TriggerSubstep', name?: string | null } | null> | null } | null> | null, actions?: Array<{ __typename?: 'Action', name?: string | null, key?: string | null, description?: string | null, substeps?: Array<{ __typename?: 'ActionSubstep', name?: string | null } | null> | null } | null> | null } | null };

export type GetAppsQueryVariables = Exact<{
  name?: InputMaybe<Scalars['String']['input']>;
  onlyWithTriggers?: InputMaybe<Scalars['Boolean']['input']>;
  onlyWithActions?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type GetAppsQuery = { __typename?: 'Query', getApps?: Array<{ __typename?: 'App', name?: string | null, key?: string | null, iconUrl?: string | null, docUrl?: string | null, authDocUrl?: string | null, primaryColor?: string | null, connectionCount?: number | null, description?: string | null, auth?: { __typename?: 'AppAuth', connectionType: string, connectionRegistrationType?: string | null, fields?: Array<{ __typename?: 'Field', key?: string | null, label?: string | null, type?: string | null, required?: boolean | null, readOnly?: boolean | null, value?: string | null, placeholder?: string | null, description?: string | null, docUrl?: string | null, clickToCopy?: boolean | null, autoComplete?: string | null, options?: Array<{ __typename?: 'ArgumentOption', label?: string | null, value?: JsonObject | null } | null> | null } | null> | null, authenticationSteps?: Array<{ __typename?: 'AuthenticationStep', type?: string | null, name?: string | null, arguments?: Array<{ __typename?: 'AuthenticationStepArgument', name?: string | null, value?: string | null, type?: ArgumentEnumType | null, properties?: Array<{ __typename?: 'AuthenticationStepProperty', name?: string | null, value?: string | null } | null> | null } | null> | null } | null> | null, reconnectionSteps?: Array<{ __typename?: 'ReconnectionStep', type?: string | null, name?: string | null, arguments?: Array<{ __typename?: 'ReconnectionStepArgument', name?: string | null, value?: string | null, type?: ArgumentEnumType | null, properties?: Array<{ __typename?: 'ReconnectionStepProperty', name?: string | null, value?: string | null } | null> | null } | null> | null } | null> | null } | null, triggers?: Array<{ __typename?: 'Trigger', name?: string | null, key?: string | null, type?: string | null, pollInterval?: number | null, description?: string | null, webhookTriggerInstructions?: { __typename?: 'TriggerInstructions', beforeUrlMsg?: string | null, afterUrlMsg?: string | null, errorMsg?: string | null, hideWebhookUrl?: boolean | null } | null, substeps?: Array<{ __typename?: 'TriggerSubstep', key?: string | null, name?: string | null, arguments?: Array<{ __typename?: 'TriggerSubstepArgument', label?: string | null, key?: string | null, type?: string | null, required?: boolean | null, description?: string | null, placeholder?: string | null, variables?: boolean | null, variableTypes?: Array<string | null> | null, allowArbitrary?: boolean | null, dependsOn?: Array<string | null> | null, value?: JsonObject | null, showOptionValue?: boolean | null, options?: Array<{ __typename?: 'ArgumentOption', label?: string | null, value?: JsonObject | null } | null> | null, source?: { __typename?: 'TriggerSubstepArgumentSource', type?: string | null, name?: string | null, arguments?: Array<{ __typename?: 'TriggerSubstepArgumentSourceArgument', name?: string | null, value?: string | null } | null> | null } | null, subFields?: Array<{ __typename?: 'TriggerSubstepArgument', label?: string | null, key?: string | null, type?: string | null, required?: boolean | null, description?: string | null, placeholder?: string | null, variables?: boolean | null, variableTypes?: Array<string | null> | null, allowArbitrary?: boolean | null, dependsOn?: Array<string | null> | null, showOptionValue?: boolean | null, options?: Array<{ __typename?: 'ArgumentOption', label?: string | null, value?: JsonObject | null } | null> | null, source?: { __typename?: 'TriggerSubstepArgumentSource', type?: string | null, name?: string | null, arguments?: Array<{ __typename?: 'TriggerSubstepArgumentSourceArgument', name?: string | null, value?: string | null } | null> | null } | null } | null> | null } | null> | null } | null> | null } | null> | null, actions?: Array<{ __typename?: 'Action', name?: string | null, key?: string | null, description?: string | null, groupsLaterSteps?: boolean | null, substeps?: Array<{ __typename?: 'ActionSubstep', key?: string | null, name?: string | null, arguments?: Array<{ __typename?: 'ActionSubstepArgument', label?: string | null, key?: string | null, type?: string | null, required?: boolean | null, description?: string | null, placeholder?: string | null, variables?: boolean | null, variableTypes?: Array<string | null> | null, allowArbitrary?: boolean | null, dependsOn?: Array<string | null> | null, hidden?: boolean | null, showOptionValue?: boolean | null, value?: JsonObject | null, options?: Array<{ __typename?: 'ArgumentOption', label?: string | null, value?: JsonObject | null } | null> | null, source?: { __typename?: 'ActionSubstepArgumentSource', type?: string | null, name?: string | null, arguments?: Array<{ __typename?: 'ActionSubstepArgumentSourceArgument', name?: string | null, value?: string | null } | null> | null } | null, subFields?: Array<{ __typename?: 'ActionSubstepArgument', label?: string | null, key?: string | null, type?: string | null, required?: boolean | null, description?: string | null, placeholder?: string | null, variables?: boolean | null, variableTypes?: Array<string | null> | null, allowArbitrary?: boolean | null, dependsOn?: Array<string | null> | null, showOptionValue?: boolean | null, options?: Array<{ __typename?: 'ArgumentOption', label?: string | null, value?: JsonObject | null } | null> | null, source?: { __typename?: 'ActionSubstepArgumentSource', type?: string | null, name?: string | null, arguments?: Array<{ __typename?: 'ActionSubstepArgumentSourceArgument', name?: string | null, value?: string | null } | null> | null } | null } | null> | null } | null> | null } | null> | null } | null> | null } | null> | null };

export type GetConnectedAppsQueryVariables = Exact<{
  name?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetConnectedAppsQuery = { __typename?: 'Query', getConnectedApps?: Array<{ __typename?: 'App', key?: string | null, name?: string | null, iconUrl?: string | null, docUrl?: string | null, primaryColor?: string | null, connectionCount?: number | null, flowCount?: number | null, auth?: { __typename?: 'AppAuth', connectionType: string } | null } | null> | null };

export type GetCurrentUserQueryVariables = Exact<{ [key: string]: never; }>;


export type GetCurrentUserQuery = { __typename?: 'Query', getCurrentUser?: { __typename?: 'User', id?: string | null, email?: string | null, createdAt?: string | null, updatedAt?: string | null } | null };

export type GetDynamicDataQueryVariables = Exact<{
  stepId: Scalars['String']['input'];
  key: Scalars['String']['input'];
  parameters?: InputMaybe<Scalars['JSONObject']['input']>;
}>;


export type GetDynamicDataQuery = { __typename?: 'Query', getDynamicData?: Array<JsonObject | null> | null };

export type GetExecutionStepsQueryVariables = Exact<{
  executionId: Scalars['String']['input'];
  limit: Scalars['Int']['input'];
  offset: Scalars['Int']['input'];
}>;


export type GetExecutionStepsQuery = { __typename?: 'Query', getExecutionSteps?: { __typename?: 'ExecutionStepConnection', pageInfo?: { __typename?: 'PageInfo', currentPage: number, totalCount: number } | null, edges?: Array<{ __typename?: 'ExecutionStepEdge', node?: { __typename?: 'ExecutionStep', id?: string | null, executionId?: string | null, status?: string | null, dataIn?: JsonObject | null, dataOut?: JsonObject | null, errorDetails?: JsonObject | null, createdAt?: string | null, updatedAt?: string | null, jobId?: string | null, appKey?: string | null } | null } | null> | null } | null };

export type GetExecutionQueryVariables = Exact<{
  executionId: Scalars['String']['input'];
}>;


export type GetExecutionQuery = { __typename?: 'Query', getExecution?: { __typename?: 'Execution', id?: string | null, testRun?: boolean | null, createdAt?: string | null, updatedAt?: string | null, flow?: { __typename?: 'Flow', id?: string | null, name?: string | null, active?: boolean | null } | null } | null };

export type GetExecutionsQueryVariables = Exact<{
  limit: Scalars['Int']['input'];
  offset: Scalars['Int']['input'];
  status?: InputMaybe<Scalars['String']['input']>;
  searchInput?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetExecutionsQuery = { __typename?: 'Query', getExecutions?: { __typename?: 'ExecutionConnection', pageInfo?: { __typename?: 'PageInfo', currentPage: number, totalCount: number } | null, edges?: Array<{ __typename?: 'ExecutionEdge', node?: { __typename?: 'Execution', id?: string | null, testRun?: boolean | null, createdAt?: string | null, updatedAt?: string | null, status?: string | null, flow?: { __typename?: 'Flow', id?: string | null, name?: string | null, active?: boolean | null, steps?: Array<{ __typename?: 'Step', iconUrl?: string | null } | null> | null } | null } | null } | null> | null } | null };

export type GetFlowQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetFlowQuery = { __typename?: 'Query', getFlow?: { __typename?: 'Flow', id?: string | null, name?: string | null, active?: boolean | null, steps?: Array<{ __typename?: 'Step', id?: string | null, type?: StepEnumType | null, key?: string | null, appKey?: string | null, iconUrl?: string | null, webhookUrl?: string | null, status?: string | null, position?: number | null, parameters?: JsonObject | null, connection?: { __typename?: 'Connection', id?: string | null, verified?: boolean | null, createdAt?: string | null } | null } | null> | null } | null };

export type GetFlowsQueryVariables = Exact<{
  limit: Scalars['Int']['input'];
  offset: Scalars['Int']['input'];
  appKey?: InputMaybe<Scalars['String']['input']>;
  connectionId?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetFlowsQuery = { __typename?: 'Query', getFlows?: { __typename?: 'FlowConnection', pageInfo?: { __typename?: 'PageInfo', currentPage: number, totalCount: number } | null, edges?: Array<{ __typename?: 'FlowEdge', node?: { __typename?: 'Flow', id?: string | null, name?: string | null, createdAt?: string | null, updatedAt?: string | null, active?: boolean | null, steps?: Array<{ __typename?: 'Step', iconUrl?: string | null } | null> | null } | null } | null> | null } | null };

export type GetStepWithTestExecutionsQueryVariables = Exact<{
  stepId: Scalars['String']['input'];
}>;


export type GetStepWithTestExecutionsQuery = { __typename?: 'Query', getStepWithTestExecutions?: Array<{ __typename?: 'Step', id?: string | null, appKey?: string | null, executionSteps?: Array<{ __typename?: 'ExecutionStep', id?: string | null, executionId?: string | null, stepId?: string | null, status?: string | null, dataOut?: JsonObject | null, dataOutMetadata?: JsonObject | null } | null> | null } | null> | null };

export type GetTableQueryVariables = Exact<{
  tableId: Scalars['String']['input'];
}>;


export type GetTableQuery = { __typename?: 'Query', getTable: { __typename?: 'TableMetadata', id: string, name: string, viewOnlyKey?: string | null, columns?: Array<{ __typename?: 'TableColumnMetadata', id: string, name: string, position: number, config: { __typename?: 'TableColumnConfig', width?: number | null } }> | null } };

export type GetTablesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetTablesQuery = { __typename?: 'Query', getTables: Array<{ __typename?: 'TableMetadata', id: string, name: string, lastAccessedAt: string }> };

export type HealthcheckQueryVariables = Exact<{ [key: string]: never; }>;


export type HealthcheckQuery = { __typename?: 'Query', healthcheck?: { __typename?: 'AppHealth', version?: string | null } | null };

export type TestConnectionQueryVariables = Exact<{
  connectionId: Scalars['String']['input'];
  stepId?: InputMaybe<Scalars['String']['input']>;
}>;


export type TestConnectionQuery = { __typename?: 'Query', testConnection?: { __typename?: 'TestConnectionResult', connectionVerified: boolean, registrationVerified?: boolean | null, message?: string | null } | null };


export const CreateConnectionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateConnection"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateConnectionInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createConnection"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}},{"kind":"Field","name":{"kind":"Name","value":"formattedData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"screenName"}}]}}]}}]}}]} as unknown as DocumentNode<CreateConnectionMutation, CreateConnectionMutationVariables>;
export const CreateFlowDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateFlow"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateFlowInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createFlow"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<CreateFlowMutation, CreateFlowMutationVariables>;
export const CreateRowDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateRow"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateTableRowInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createRow"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<CreateRowMutation, CreateRowMutationVariables>;
export const CreateRowsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateRows"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateTableRowsInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createRows"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<CreateRowsMutation, CreateRowsMutationVariables>;
export const CreateShareableTableLinkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateShareableTableLink"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tableId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createShareableTableLink"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tableId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tableId"}}}]}]}}]} as unknown as DocumentNode<CreateShareableTableLinkMutation, CreateShareableTableLinkMutationVariables>;
export const CreateStepDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateStep"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateStepInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createStep"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"appKey"}},{"kind":"Field","name":{"kind":"Name","value":"parameters"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"connection"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<CreateStepMutation, CreateStepMutationVariables>;
export const CreateTableDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateTable"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateTableInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createTable"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<CreateTableMutation, CreateTableMutationVariables>;
export const DeleteConnectionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteConnection"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"DeleteConnectionInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteConnection"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<DeleteConnectionMutation, DeleteConnectionMutationVariables>;
export const DeleteFlowDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteFlow"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"DeleteFlowInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteFlow"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<DeleteFlowMutation, DeleteFlowMutationVariables>;
export const DeleteRowsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteRows"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DeleteTableRowsInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteRows"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<DeleteRowsMutation, DeleteRowsMutationVariables>;
export const DeleteStepDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteStep"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"DeleteStepInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteStep"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"steps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<DeleteStepMutation, DeleteStepMutationVariables>;
export const DeleteTableDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteTable"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DeleteTableInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteTable"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<DeleteTableMutation, DeleteTableMutationVariables>;
export const ExecuteFlowDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ExecuteFlow"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ExecuteFlowInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"executeFlow"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"step"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"appKey"}},{"kind":"Field","name":{"kind":"Name","value":"executionSteps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"executionId"}},{"kind":"Field","name":{"kind":"Name","value":"stepId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"dataOut"}},{"kind":"Field","name":{"kind":"Name","value":"dataOutMetadata"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"data"}}]}}]}}]} as unknown as DocumentNode<ExecuteFlowMutation, ExecuteFlowMutationVariables>;
export const GenerateAuthUrlDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"generateAuthUrl"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"GenerateAuthUrlInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"generateAuthUrl"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}}]} as unknown as DocumentNode<GenerateAuthUrlMutation, GenerateAuthUrlMutationVariables>;
export const LoginWithSelectedSgidDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LoginWithSelectedSgid"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LoginWithSelectedSgidInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginWithSelectedSgid"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}}]}}]}}]} as unknown as DocumentNode<LoginWithSelectedSgidMutation, LoginWithSelectedSgidMutationVariables>;
export const LoginWithSgidDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LoginWithSgid"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LoginWithSgidInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginWithSgid"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publicOfficerEmployments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"workEmail"}},{"kind":"Field","name":{"kind":"Name","value":"agencyName"}},{"kind":"Field","name":{"kind":"Name","value":"departmentName"}},{"kind":"Field","name":{"kind":"Name","value":"employmentTitle"}}]}}]}}]}}]} as unknown as DocumentNode<LoginWithSgidMutation, LoginWithSgidMutationVariables>;
export const LogoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Logout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logout"}}]}}]} as unknown as DocumentNode<LogoutMutation, LogoutMutationVariables>;
export const RegisterConnectionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RegisterConnection"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"RegisterConnectionInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"registerConnection"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<RegisterConnectionMutation, RegisterConnectionMutationVariables>;
export const RequestOtpDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RequestOtp"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"RequestOtpInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"requestOtp"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<RequestOtpMutation, RequestOtpMutationVariables>;
export const ResetConnectionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResetConnection"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ResetConnectionInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resetConnection"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<ResetConnectionMutation, ResetConnectionMutationVariables>;
export const RetryExecutionStepDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RetryExecutionStep"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"RetryExecutionStepInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"retryExecutionStep"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<RetryExecutionStepMutation, RetryExecutionStepMutationVariables>;
export const UpdateConnectionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateConnection"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateConnectionInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateConnection"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}},{"kind":"Field","name":{"kind":"Name","value":"formattedData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"screenName"}}]}}]}}]}}]} as unknown as DocumentNode<UpdateConnectionMutation, UpdateConnectionMutationVariables>;
export const UpdateFlowStatusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateFlowStatus"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateFlowStatusInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateFlowStatus"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"active"}}]}}]}}]} as unknown as DocumentNode<UpdateFlowStatusMutation, UpdateFlowStatusMutationVariables>;
export const UpdateFlowDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateFlow"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateFlowInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateFlow"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<UpdateFlowMutation, UpdateFlowMutationVariables>;
export const UpdateRowDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateRow"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateTableRowInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateRow"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<UpdateRowMutation, UpdateRowMutationVariables>;
export const UpdateStepDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateStep"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateStepInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateStep"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"appKey"}},{"kind":"Field","name":{"kind":"Name","value":"webhookUrl"}},{"kind":"Field","name":{"kind":"Name","value":"parameters"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"connection"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<UpdateStepMutation, UpdateStepMutationVariables>;
export const UpdateTableDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateTable"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateTableInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateTable"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UpdateTableMutation, UpdateTableMutationVariables>;
export const VerifyConnectionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VerifyConnection"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"VerifyConnectionInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"verifyConnection"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}},{"kind":"Field","name":{"kind":"Name","value":"formattedData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"screenName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"app"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}}]}}]}}]}}]} as unknown as DocumentNode<VerifyConnectionMutation, VerifyConnectionMutationVariables>;
export const VerifyOtpDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VerifyOtp"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"VerifyOtpInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"verifyOtp"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<VerifyOtpMutation, VerifyOtpMutationVariables>;
export const GetAllRowsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAllRows"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tableId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getAllRows"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tableId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tableId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rowId"}},{"kind":"Field","name":{"kind":"Name","value":"data"}}]}}]}}]} as unknown as DocumentNode<GetAllRowsQuery, GetAllRowsQueryVariables>;
export const GetAppConnectionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAppConnections"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"key"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getApp"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"key"},"value":{"kind":"Variable","name":{"kind":"Name","value":"key"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"connections"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}},{"kind":"Field","name":{"kind":"Name","value":"flowCount"}},{"kind":"Field","name":{"kind":"Name","value":"formattedData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"screenName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}}]} as unknown as DocumentNode<GetAppConnectionsQuery, GetAppConnectionsQueryVariables>;
export const GetAppDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetApp"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"key"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getApp"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"key"},"value":{"kind":"Variable","name":{"kind":"Name","value":"key"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"iconUrl"}},{"kind":"Field","name":{"kind":"Name","value":"docUrl"}},{"kind":"Field","name":{"kind":"Name","value":"authDocUrl"}},{"kind":"Field","name":{"kind":"Name","value":"primaryColor"}},{"kind":"Field","name":{"kind":"Name","value":"auth"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"connectionType"}},{"kind":"Field","name":{"kind":"Name","value":"connectionRegistrationType"}},{"kind":"Field","name":{"kind":"Name","value":"fields"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"required"}},{"kind":"Field","name":{"kind":"Name","value":"readOnly"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"docUrl"}},{"kind":"Field","name":{"kind":"Name","value":"allowArbitrary"}},{"kind":"Field","name":{"kind":"Name","value":"clickToCopy"}},{"kind":"Field","name":{"kind":"Name","value":"autoComplete"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"authenticationSteps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"arguments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"properties"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"reconnectionSteps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"arguments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"properties"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"connections"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"triggers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"pollInterval"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"substeps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"actions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"substeps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetAppQuery, GetAppQueryVariables>;
export const GetAppsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetApps"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"onlyWithTriggers"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"onlyWithActions"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getApps"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"onlyWithTriggers"},"value":{"kind":"Variable","name":{"kind":"Name","value":"onlyWithTriggers"}}},{"kind":"Argument","name":{"kind":"Name","value":"onlyWithActions"},"value":{"kind":"Variable","name":{"kind":"Name","value":"onlyWithActions"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"iconUrl"}},{"kind":"Field","name":{"kind":"Name","value":"docUrl"}},{"kind":"Field","name":{"kind":"Name","value":"authDocUrl"}},{"kind":"Field","name":{"kind":"Name","value":"primaryColor"}},{"kind":"Field","name":{"kind":"Name","value":"connectionCount"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"auth"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"connectionType"}},{"kind":"Field","name":{"kind":"Name","value":"connectionRegistrationType"}},{"kind":"Field","name":{"kind":"Name","value":"fields"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"required"}},{"kind":"Field","name":{"kind":"Name","value":"readOnly"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"docUrl"}},{"kind":"Field","name":{"kind":"Name","value":"clickToCopy"}},{"kind":"Field","name":{"kind":"Name","value":"autoComplete"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"authenticationSteps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"arguments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"properties"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"reconnectionSteps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"arguments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"properties"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"triggers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"pollInterval"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"webhookTriggerInstructions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"beforeUrlMsg"}},{"kind":"Field","name":{"kind":"Name","value":"afterUrlMsg"}},{"kind":"Field","name":{"kind":"Name","value":"errorMsg"}},{"kind":"Field","name":{"kind":"Name","value":"hideWebhookUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"substeps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"arguments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"required"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"variables"}},{"kind":"Field","name":{"kind":"Name","value":"variableTypes"}},{"kind":"Field","name":{"kind":"Name","value":"allowArbitrary"}},{"kind":"Field","name":{"kind":"Name","value":"dependsOn"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"showOptionValue"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"source"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"arguments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"subFields"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"required"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"variables"}},{"kind":"Field","name":{"kind":"Name","value":"variableTypes"}},{"kind":"Field","name":{"kind":"Name","value":"allowArbitrary"}},{"kind":"Field","name":{"kind":"Name","value":"dependsOn"}},{"kind":"Field","name":{"kind":"Name","value":"showOptionValue"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"source"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"arguments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"actions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"groupsLaterSteps"}},{"kind":"Field","name":{"kind":"Name","value":"substeps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"arguments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"required"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"variables"}},{"kind":"Field","name":{"kind":"Name","value":"variableTypes"}},{"kind":"Field","name":{"kind":"Name","value":"allowArbitrary"}},{"kind":"Field","name":{"kind":"Name","value":"dependsOn"}},{"kind":"Field","name":{"kind":"Name","value":"hidden"}},{"kind":"Field","name":{"kind":"Name","value":"showOptionValue"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"source"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"arguments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"subFields"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"required"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"variables"}},{"kind":"Field","name":{"kind":"Name","value":"variableTypes"}},{"kind":"Field","name":{"kind":"Name","value":"allowArbitrary"}},{"kind":"Field","name":{"kind":"Name","value":"dependsOn"}},{"kind":"Field","name":{"kind":"Name","value":"showOptionValue"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"source"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"arguments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetAppsQuery, GetAppsQueryVariables>;
export const GetConnectedAppsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetConnectedApps"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getConnectedApps"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"iconUrl"}},{"kind":"Field","name":{"kind":"Name","value":"docUrl"}},{"kind":"Field","name":{"kind":"Name","value":"primaryColor"}},{"kind":"Field","name":{"kind":"Name","value":"connectionCount"}},{"kind":"Field","name":{"kind":"Name","value":"flowCount"}},{"kind":"Field","name":{"kind":"Name","value":"auth"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"connectionType"}}]}}]}}]}}]} as unknown as DocumentNode<GetConnectedAppsQuery, GetConnectedAppsQueryVariables>;
export const GetCurrentUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetCurrentUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getCurrentUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<GetCurrentUserQuery, GetCurrentUserQueryVariables>;
export const GetDynamicDataDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetDynamicData"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"stepId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"key"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"parameters"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"JSONObject"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getDynamicData"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"stepId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"stepId"}}},{"kind":"Argument","name":{"kind":"Name","value":"key"},"value":{"kind":"Variable","name":{"kind":"Name","value":"key"}}},{"kind":"Argument","name":{"kind":"Name","value":"parameters"},"value":{"kind":"Variable","name":{"kind":"Name","value":"parameters"}}}]}]}}]} as unknown as DocumentNode<GetDynamicDataQuery, GetDynamicDataQueryVariables>;
export const GetExecutionStepsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetExecutionSteps"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"executionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getExecutionSteps"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"executionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"executionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currentPage"}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"executionId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"dataIn"}},{"kind":"Field","name":{"kind":"Name","value":"dataOut"}},{"kind":"Field","name":{"kind":"Name","value":"errorDetails"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"jobId"}},{"kind":"Field","name":{"kind":"Name","value":"appKey"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetExecutionStepsQuery, GetExecutionStepsQueryVariables>;
export const GetExecutionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetExecution"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"executionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getExecution"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"executionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"executionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"testRun"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"flow"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"active"}}]}}]}}]}}]} as unknown as DocumentNode<GetExecutionQuery, GetExecutionQueryVariables>;
export const GetExecutionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetExecutions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"status"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"searchInput"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getExecutions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}},{"kind":"Argument","name":{"kind":"Name","value":"status"},"value":{"kind":"Variable","name":{"kind":"Name","value":"status"}}},{"kind":"Argument","name":{"kind":"Name","value":"searchInput"},"value":{"kind":"Variable","name":{"kind":"Name","value":"searchInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currentPage"}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"testRun"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"flow"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"steps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"iconUrl"}}]}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetExecutionsQuery, GetExecutionsQueryVariables>;
export const GetFlowDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFlow"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getFlow"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"steps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"appKey"}},{"kind":"Field","name":{"kind":"Name","value":"iconUrl"}},{"kind":"Field","name":{"kind":"Name","value":"webhookUrl"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"connection"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"parameters"}}]}}]}}]}}]} as unknown as DocumentNode<GetFlowQuery, GetFlowQueryVariables>;
export const GetFlowsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFlows"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"appKey"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"connectionId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getFlows"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}},{"kind":"Argument","name":{"kind":"Name","value":"appKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"appKey"}}},{"kind":"Argument","name":{"kind":"Name","value":"connectionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"connectionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currentPage"}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"steps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"iconUrl"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetFlowsQuery, GetFlowsQueryVariables>;
export const GetStepWithTestExecutionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetStepWithTestExecutions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"stepId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getStepWithTestExecutions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"stepId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"stepId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"appKey"}},{"kind":"Field","name":{"kind":"Name","value":"executionSteps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"executionId"}},{"kind":"Field","name":{"kind":"Name","value":"stepId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"dataOut"}},{"kind":"Field","name":{"kind":"Name","value":"dataOutMetadata"}}]}}]}}]}}]} as unknown as DocumentNode<GetStepWithTestExecutionsQuery, GetStepWithTestExecutionsQueryVariables>;
export const GetTableDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetTable"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tableId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getTable"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"tableId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tableId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"viewOnlyKey"}},{"kind":"Field","name":{"kind":"Name","value":"columns"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"config"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"width"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetTableQuery, GetTableQueryVariables>;
export const GetTablesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetTables"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getTables"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"lastAccessedAt"}}]}}]}}]} as unknown as DocumentNode<GetTablesQuery, GetTablesQueryVariables>;
export const HealthcheckDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Healthcheck"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"healthcheck"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"version"}}]}}]}}]} as unknown as DocumentNode<HealthcheckQuery, HealthcheckQueryVariables>;
export const TestConnectionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TestConnection"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"connectionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"stepId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"testConnection"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"connectionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"connectionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"stepId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"stepId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"connectionVerified"}},{"kind":"Field","name":{"kind":"Name","value":"registrationVerified"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]} as unknown as DocumentNode<TestConnectionQuery, TestConnectionQueryVariables>;
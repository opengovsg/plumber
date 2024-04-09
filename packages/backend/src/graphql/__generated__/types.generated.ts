import type { JsonObject } from 'type-fest';
import type { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import type { AppGraphQLType, ExecutionConnectionGraphQLType, ExecutionStepGraphQLType, ExecutionStepConnectionGraphQLType, FlowConnectionGraphQLType, TableMetadataGraphQLType } from './../schema.gql-to-typescript';
import type { AuthenticatedGraphQLContext, UnauthenticatedGraphQLContext } from '@/graphql/schema.context';
export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string | number; }
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

export type ArgumentEnumType =
  | 'integer'
  | 'string';

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


export type MutationcreateConnectionArgs = {
  input?: InputMaybe<CreateConnectionInput>;
};


export type MutationcreateFlowArgs = {
  input?: InputMaybe<CreateFlowInput>;
};


export type MutationcreateRowArgs = {
  input: CreateTableRowInput;
};


export type MutationcreateRowsArgs = {
  input: CreateTableRowsInput;
};


export type MutationcreateShareableTableLinkArgs = {
  tableId: Scalars['ID']['input'];
};


export type MutationcreateStepArgs = {
  input?: InputMaybe<CreateStepInput>;
};


export type MutationcreateTableArgs = {
  input: CreateTableInput;
};


export type MutationdeleteConnectionArgs = {
  input?: InputMaybe<DeleteConnectionInput>;
};


export type MutationdeleteFlowArgs = {
  input?: InputMaybe<DeleteFlowInput>;
};


export type MutationdeleteRowsArgs = {
  input: DeleteTableRowsInput;
};


export type MutationdeleteStepArgs = {
  input?: InputMaybe<DeleteStepInput>;
};


export type MutationdeleteTableArgs = {
  input: DeleteTableInput;
};


export type MutationexecuteFlowArgs = {
  input?: InputMaybe<ExecuteFlowInput>;
};


export type MutationgenerateAuthUrlArgs = {
  input?: InputMaybe<GenerateAuthUrlInput>;
};


export type MutationloginWithSelectedSgidArgs = {
  input: LoginWithSelectedSgidInput;
};


export type MutationloginWithSgidArgs = {
  input: LoginWithSgidInput;
};


export type MutationregisterConnectionArgs = {
  input?: InputMaybe<RegisterConnectionInput>;
};


export type MutationrequestOtpArgs = {
  input?: InputMaybe<RequestOtpInput>;
};


export type MutationresetConnectionArgs = {
  input?: InputMaybe<ResetConnectionInput>;
};


export type MutationretryExecutionStepArgs = {
  input?: InputMaybe<RetryExecutionStepInput>;
};


export type MutationupdateConnectionArgs = {
  input?: InputMaybe<UpdateConnectionInput>;
};


export type MutationupdateFlowArgs = {
  input?: InputMaybe<UpdateFlowInput>;
};


export type MutationupdateFlowStatusArgs = {
  input?: InputMaybe<UpdateFlowStatusInput>;
};


export type MutationupdateRowArgs = {
  input: UpdateTableRowInput;
};


export type MutationupdateStepArgs = {
  input?: InputMaybe<UpdateStepInput>;
};


export type MutationupdateTableArgs = {
  input: UpdateTableInput;
};


export type MutationverifyConnectionArgs = {
  input?: InputMaybe<VerifyConnectionInput>;
};


export type MutationverifyOtpArgs = {
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


export type QuerygetAllRowsArgs = {
  tableId: Scalars['String']['input'];
};


export type QuerygetAppArgs = {
  key: Scalars['String']['input'];
};


export type QuerygetAppsArgs = {
  name?: InputMaybe<Scalars['String']['input']>;
  onlyWithActions?: InputMaybe<Scalars['Boolean']['input']>;
  onlyWithTriggers?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QuerygetConnectedAppsArgs = {
  name?: InputMaybe<Scalars['String']['input']>;
};


export type QuerygetDynamicDataArgs = {
  key: Scalars['String']['input'];
  parameters?: InputMaybe<Scalars['JSONObject']['input']>;
  stepId: Scalars['String']['input'];
};


export type QuerygetExecutionArgs = {
  executionId: Scalars['String']['input'];
};


export type QuerygetExecutionStepsArgs = {
  executionId: Scalars['String']['input'];
  limit: Scalars['Int']['input'];
  offset: Scalars['Int']['input'];
};


export type QuerygetExecutionsArgs = {
  limit: Scalars['Int']['input'];
  offset: Scalars['Int']['input'];
  searchInput?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
};


export type QuerygetFlowArgs = {
  id: Scalars['String']['input'];
};


export type QuerygetFlowsArgs = {
  appKey?: InputMaybe<Scalars['String']['input']>;
  connectionId?: InputMaybe<Scalars['String']['input']>;
  limit: Scalars['Int']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  offset: Scalars['Int']['input'];
};


export type QuerygetStepWithTestExecutionsArgs = {
  stepId: Scalars['String']['input'];
};


export type QuerygetTableArgs = {
  tableId: Scalars['String']['input'];
};


export type QuerytestConnectionArgs = {
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

export type StepEnumType =
  | 'action'
  | 'trigger';

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



export type ResolverTypeWrapper<T> = T;

export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info?: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info?: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info?: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info?: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info?: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info?: GraphQLResolveInfo
) => TResult | Promise<TResult>;



/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  Action: ResolverTypeWrapper<Action>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  ActionSubstep: ResolverTypeWrapper<ActionSubstep>;
  ActionSubstepArgument: ResolverTypeWrapper<ActionSubstepArgument>;
  ActionSubstepArgumentSource: ResolverTypeWrapper<ActionSubstepArgumentSource>;
  ActionSubstepArgumentSourceArgument: ResolverTypeWrapper<ActionSubstepArgumentSourceArgument>;
  App: ResolverTypeWrapper<AppGraphQLType>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  AppAuth: ResolverTypeWrapper<AppAuth>;
  AppHealth: ResolverTypeWrapper<AppHealth>;
  ArgumentEnumType: ArgumentEnumType;
  ArgumentOption: ResolverTypeWrapper<ArgumentOption>;
  AuthLink: ResolverTypeWrapper<AuthLink>;
  AuthenticationStep: ResolverTypeWrapper<AuthenticationStep>;
  AuthenticationStepArgument: ResolverTypeWrapper<AuthenticationStepArgument>;
  AuthenticationStepProperty: ResolverTypeWrapper<AuthenticationStepProperty>;
  Connection: ResolverTypeWrapper<Omit<Connection, 'app'> & { app?: Maybe<ResolversTypes['App']> }>;
  ConnectionData: ResolverTypeWrapper<ConnectionData>;
  CreateConnectionInput: CreateConnectionInput;
  CreateFlowInput: CreateFlowInput;
  CreateStepInput: CreateStepInput;
  CreateTableInput: CreateTableInput;
  CreateTableRowInput: CreateTableRowInput;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  CreateTableRowsInput: CreateTableRowsInput;
  DeleteConnectionInput: DeleteConnectionInput;
  DeleteFlowInput: DeleteFlowInput;
  DeleteStepInput: DeleteStepInput;
  DeleteTableInput: DeleteTableInput;
  DeleteTableRowsInput: DeleteTableRowsInput;
  ExecuteFlowInput: ExecuteFlowInput;
  ExecuteFlowType: ResolverTypeWrapper<Omit<ExecuteFlowType, 'step'> & { step?: Maybe<ResolversTypes['Step']> }>;
  Execution: ResolverTypeWrapper<Omit<Execution, 'flow'> & { flow?: Maybe<ResolversTypes['Flow']> }>;
  ExecutionConnection: ResolverTypeWrapper<ExecutionConnectionGraphQLType>;
  ExecutionEdge: ResolverTypeWrapper<Omit<ExecutionEdge, 'node'> & { node?: Maybe<ResolversTypes['Execution']> }>;
  ExecutionStep: ResolverTypeWrapper<ExecutionStepGraphQLType>;
  ExecutionStepConnection: ResolverTypeWrapper<ExecutionStepConnectionGraphQLType>;
  ExecutionStepEdge: ResolverTypeWrapper<Omit<ExecutionStepEdge, 'node'> & { node?: Maybe<ResolversTypes['ExecutionStep']> }>;
  Field: ResolverTypeWrapper<Field>;
  Flow: ResolverTypeWrapper<Omit<Flow, 'steps'> & { steps?: Maybe<Array<Maybe<ResolversTypes['Step']>>> }>;
  FlowConnection: ResolverTypeWrapper<FlowConnectionGraphQLType>;
  FlowEdge: ResolverTypeWrapper<Omit<FlowEdge, 'node'> & { node?: Maybe<ResolversTypes['Flow']> }>;
  GenerateAuthUrlInput: GenerateAuthUrlInput;
  JSONObject: ResolverTypeWrapper<Scalars['JSONObject']['output']>;
  LoginWithSelectedSgidInput: LoginWithSelectedSgidInput;
  LoginWithSelectedSgidResult: ResolverTypeWrapper<LoginWithSelectedSgidResult>;
  LoginWithSgidInput: LoginWithSgidInput;
  LoginWithSgidResult: ResolverTypeWrapper<LoginWithSgidResult>;
  Mutation: ResolverTypeWrapper<{}>;
  PageInfo: ResolverTypeWrapper<PageInfo>;
  PreviousStepInput: PreviousStepInput;
  Query: ResolverTypeWrapper<{}>;
  ReconnectionStep: ResolverTypeWrapper<ReconnectionStep>;
  ReconnectionStepArgument: ResolverTypeWrapper<ReconnectionStepArgument>;
  ReconnectionStepProperty: ResolverTypeWrapper<ReconnectionStepProperty>;
  RegisterConnectionInput: RegisterConnectionInput;
  RequestOtpInput: RequestOtpInput;
  ResetConnectionInput: ResetConnectionInput;
  RetryExecutionStepInput: RetryExecutionStepInput;
  SgidPublicOfficerEmployment: ResolverTypeWrapper<SgidPublicOfficerEmployment>;
  Step: ResolverTypeWrapper<Omit<Step, 'connection' | 'executionSteps' | 'flow'> & { connection?: Maybe<ResolversTypes['Connection']>, executionSteps?: Maybe<Array<Maybe<ResolversTypes['ExecutionStep']>>>, flow?: Maybe<ResolversTypes['Flow']> }>;
  StepConnectionInput: StepConnectionInput;
  StepEnumType: StepEnumType;
  StepFlowInput: StepFlowInput;
  StepInput: StepInput;
  TableColumnConfig: ResolverTypeWrapper<TableColumnConfig>;
  TableColumnConfigInput: TableColumnConfigInput;
  TableColumnMetadata: ResolverTypeWrapper<TableColumnMetadata>;
  TableColumnMetadataInput: TableColumnMetadataInput;
  TableMetadata: ResolverTypeWrapper<TableMetadataGraphQLType>;
  TestConnectionResult: ResolverTypeWrapper<TestConnectionResult>;
  TileRow: ResolverTypeWrapper<TileRow>;
  Trigger: ResolverTypeWrapper<Trigger>;
  TriggerInstructions: ResolverTypeWrapper<TriggerInstructions>;
  TriggerSubstep: ResolverTypeWrapper<TriggerSubstep>;
  TriggerSubstepArgument: ResolverTypeWrapper<TriggerSubstepArgument>;
  TriggerSubstepArgumentSource: ResolverTypeWrapper<TriggerSubstepArgumentSource>;
  TriggerSubstepArgumentSourceArgument: ResolverTypeWrapper<TriggerSubstepArgumentSourceArgument>;
  UpdateConnectionInput: UpdateConnectionInput;
  UpdateFlowInput: UpdateFlowInput;
  UpdateFlowStatusInput: UpdateFlowStatusInput;
  UpdateStepInput: UpdateStepInput;
  UpdateTableInput: UpdateTableInput;
  UpdateTableRowInput: UpdateTableRowInput;
  User: ResolverTypeWrapper<User>;
  VerifyConnectionInput: VerifyConnectionInput;
  VerifyOtpInput: VerifyOtpInput;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Action: Action;
  String: Scalars['String']['output'];
  Boolean: Scalars['Boolean']['output'];
  ActionSubstep: ActionSubstep;
  ActionSubstepArgument: ActionSubstepArgument;
  ActionSubstepArgumentSource: ActionSubstepArgumentSource;
  ActionSubstepArgumentSourceArgument: ActionSubstepArgumentSourceArgument;
  App: AppGraphQLType;
  Int: Scalars['Int']['output'];
  AppAuth: AppAuth;
  AppHealth: AppHealth;
  ArgumentOption: ArgumentOption;
  AuthLink: AuthLink;
  AuthenticationStep: AuthenticationStep;
  AuthenticationStepArgument: AuthenticationStepArgument;
  AuthenticationStepProperty: AuthenticationStepProperty;
  Connection: Omit<Connection, 'app'> & { app?: Maybe<ResolversParentTypes['App']> };
  ConnectionData: ConnectionData;
  CreateConnectionInput: CreateConnectionInput;
  CreateFlowInput: CreateFlowInput;
  CreateStepInput: CreateStepInput;
  CreateTableInput: CreateTableInput;
  CreateTableRowInput: CreateTableRowInput;
  ID: Scalars['ID']['output'];
  CreateTableRowsInput: CreateTableRowsInput;
  DeleteConnectionInput: DeleteConnectionInput;
  DeleteFlowInput: DeleteFlowInput;
  DeleteStepInput: DeleteStepInput;
  DeleteTableInput: DeleteTableInput;
  DeleteTableRowsInput: DeleteTableRowsInput;
  ExecuteFlowInput: ExecuteFlowInput;
  ExecuteFlowType: Omit<ExecuteFlowType, 'step'> & { step?: Maybe<ResolversParentTypes['Step']> };
  Execution: Omit<Execution, 'flow'> & { flow?: Maybe<ResolversParentTypes['Flow']> };
  ExecutionConnection: ExecutionConnectionGraphQLType;
  ExecutionEdge: Omit<ExecutionEdge, 'node'> & { node?: Maybe<ResolversParentTypes['Execution']> };
  ExecutionStep: ExecutionStepGraphQLType;
  ExecutionStepConnection: ExecutionStepConnectionGraphQLType;
  ExecutionStepEdge: Omit<ExecutionStepEdge, 'node'> & { node?: Maybe<ResolversParentTypes['ExecutionStep']> };
  Field: Field;
  Flow: Omit<Flow, 'steps'> & { steps?: Maybe<Array<Maybe<ResolversParentTypes['Step']>>> };
  FlowConnection: FlowConnectionGraphQLType;
  FlowEdge: Omit<FlowEdge, 'node'> & { node?: Maybe<ResolversParentTypes['Flow']> };
  GenerateAuthUrlInput: GenerateAuthUrlInput;
  JSONObject: Scalars['JSONObject']['output'];
  LoginWithSelectedSgidInput: LoginWithSelectedSgidInput;
  LoginWithSelectedSgidResult: LoginWithSelectedSgidResult;
  LoginWithSgidInput: LoginWithSgidInput;
  LoginWithSgidResult: LoginWithSgidResult;
  Mutation: {};
  PageInfo: PageInfo;
  PreviousStepInput: PreviousStepInput;
  Query: {};
  ReconnectionStep: ReconnectionStep;
  ReconnectionStepArgument: ReconnectionStepArgument;
  ReconnectionStepProperty: ReconnectionStepProperty;
  RegisterConnectionInput: RegisterConnectionInput;
  RequestOtpInput: RequestOtpInput;
  ResetConnectionInput: ResetConnectionInput;
  RetryExecutionStepInput: RetryExecutionStepInput;
  SgidPublicOfficerEmployment: SgidPublicOfficerEmployment;
  Step: Omit<Step, 'connection' | 'executionSteps' | 'flow'> & { connection?: Maybe<ResolversParentTypes['Connection']>, executionSteps?: Maybe<Array<Maybe<ResolversParentTypes['ExecutionStep']>>>, flow?: Maybe<ResolversParentTypes['Flow']> };
  StepConnectionInput: StepConnectionInput;
  StepFlowInput: StepFlowInput;
  StepInput: StepInput;
  TableColumnConfig: TableColumnConfig;
  TableColumnConfigInput: TableColumnConfigInput;
  TableColumnMetadata: TableColumnMetadata;
  TableColumnMetadataInput: TableColumnMetadataInput;
  TableMetadata: TableMetadataGraphQLType;
  TestConnectionResult: TestConnectionResult;
  TileRow: TileRow;
  Trigger: Trigger;
  TriggerInstructions: TriggerInstructions;
  TriggerSubstep: TriggerSubstep;
  TriggerSubstepArgument: TriggerSubstepArgument;
  TriggerSubstepArgumentSource: TriggerSubstepArgumentSource;
  TriggerSubstepArgumentSourceArgument: TriggerSubstepArgumentSourceArgument;
  UpdateConnectionInput: UpdateConnectionInput;
  UpdateFlowInput: UpdateFlowInput;
  UpdateFlowStatusInput: UpdateFlowStatusInput;
  UpdateStepInput: UpdateStepInput;
  UpdateTableInput: UpdateTableInput;
  UpdateTableRowInput: UpdateTableRowInput;
  User: User;
  VerifyConnectionInput: VerifyConnectionInput;
  VerifyOtpInput: VerifyOtpInput;
};

export type ActionResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['Action'] = ResolversParentTypes['Action']> = {
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  groupsLaterSteps?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  key?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  substeps?: Resolver<Maybe<Array<Maybe<ResolversTypes['ActionSubstep']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ActionSubstepResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['ActionSubstep'] = ResolversParentTypes['ActionSubstep']> = {
  arguments?: Resolver<Maybe<Array<Maybe<ResolversTypes['ActionSubstepArgument']>>>, ParentType, ContextType>;
  key?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ActionSubstepArgumentResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['ActionSubstepArgument'] = ResolversParentTypes['ActionSubstepArgument']> = {
  allowArbitrary?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  dependsOn?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hidden?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  key?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  label?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  options?: Resolver<Maybe<Array<Maybe<ResolversTypes['ArgumentOption']>>>, ParentType, ContextType>;
  placeholder?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  required?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  showOptionValue?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  source?: Resolver<Maybe<ResolversTypes['ActionSubstepArgumentSource']>, ParentType, ContextType>;
  subFields?: Resolver<Maybe<Array<Maybe<ResolversTypes['ActionSubstepArgument']>>>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  value?: Resolver<Maybe<ResolversTypes['JSONObject']>, ParentType, ContextType>;
  variableTypes?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  variables?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ActionSubstepArgumentSourceResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['ActionSubstepArgumentSource'] = ResolversParentTypes['ActionSubstepArgumentSource']> = {
  arguments?: Resolver<Maybe<Array<Maybe<ResolversTypes['ActionSubstepArgumentSourceArgument']>>>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ActionSubstepArgumentSourceArgumentResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['ActionSubstepArgumentSourceArgument'] = ResolversParentTypes['ActionSubstepArgumentSourceArgument']> = {
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  value?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AppResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['App'] = ResolversParentTypes['App']> = {
  actions?: Resolver<Maybe<Array<Maybe<ResolversTypes['Action']>>>, ParentType, ContextType>;
  auth?: Resolver<Maybe<ResolversTypes['AppAuth']>, ParentType, ContextType>;
  authDocUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  connectionCount?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  connections?: Resolver<Maybe<Array<Maybe<ResolversTypes['Connection']>>>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  docUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  flowCount?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  iconUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  key?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  primaryColor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  triggers?: Resolver<Maybe<Array<Maybe<ResolversTypes['Trigger']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AppAuthResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['AppAuth'] = ResolversParentTypes['AppAuth']> = {
  authenticationSteps?: Resolver<Maybe<Array<Maybe<ResolversTypes['AuthenticationStep']>>>, ParentType, ContextType>;
  connectionRegistrationType?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  connectionType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  fields?: Resolver<Maybe<Array<Maybe<ResolversTypes['Field']>>>, ParentType, ContextType>;
  reconnectionSteps?: Resolver<Maybe<Array<Maybe<ResolversTypes['ReconnectionStep']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AppHealthResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['AppHealth'] = ResolversParentTypes['AppHealth']> = {
  version?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ArgumentOptionResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['ArgumentOption'] = ResolversParentTypes['ArgumentOption']> = {
  label?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  value?: Resolver<Maybe<ResolversTypes['JSONObject']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AuthLinkResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['AuthLink'] = ResolversParentTypes['AuthLink']> = {
  url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AuthenticationStepResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['AuthenticationStep'] = ResolversParentTypes['AuthenticationStep']> = {
  arguments?: Resolver<Maybe<Array<Maybe<ResolversTypes['AuthenticationStepArgument']>>>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AuthenticationStepArgumentResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['AuthenticationStepArgument'] = ResolversParentTypes['AuthenticationStepArgument']> = {
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  properties?: Resolver<Maybe<Array<Maybe<ResolversTypes['AuthenticationStepProperty']>>>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['ArgumentEnumType']>, ParentType, ContextType>;
  value?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AuthenticationStepPropertyResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['AuthenticationStepProperty'] = ResolversParentTypes['AuthenticationStepProperty']> = {
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  value?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ConnectionResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['Connection'] = ResolversParentTypes['Connection']> = {
  app?: Resolver<Maybe<ResolversTypes['App']>, ParentType, ContextType>;
  createdAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  flowCount?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  formattedData?: Resolver<Maybe<ResolversTypes['ConnectionData']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  key?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  verified?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ConnectionDataResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['ConnectionData'] = ResolversParentTypes['ConnectionData']> = {
  screenName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ExecuteFlowTypeResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['ExecuteFlowType'] = ResolversParentTypes['ExecuteFlowType']> = {
  data?: Resolver<Maybe<ResolversTypes['JSONObject']>, ParentType, ContextType>;
  step?: Resolver<Maybe<ResolversTypes['Step']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ExecutionResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['Execution'] = ResolversParentTypes['Execution']> = {
  createdAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  flow?: Resolver<Maybe<ResolversTypes['Flow']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  status?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  testRun?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ExecutionConnectionResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['ExecutionConnection'] = ResolversParentTypes['ExecutionConnection']> = {
  edges?: Resolver<Maybe<Array<Maybe<ResolversTypes['ExecutionEdge']>>>, ParentType, ContextType>;
  pageInfo?: Resolver<Maybe<ResolversTypes['PageInfo']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ExecutionEdgeResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['ExecutionEdge'] = ResolversParentTypes['ExecutionEdge']> = {
  node?: Resolver<Maybe<ResolversTypes['Execution']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ExecutionStepResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['ExecutionStep'] = ResolversParentTypes['ExecutionStep']> = {
  appKey?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  dataIn?: Resolver<Maybe<ResolversTypes['JSONObject']>, ParentType, ContextType>;
  dataOut?: Resolver<Maybe<ResolversTypes['JSONObject']>, ParentType, ContextType>;
  dataOutMetadata?: Resolver<Maybe<ResolversTypes['JSONObject']>, ParentType, ContextType>;
  errorDetails?: Resolver<Maybe<ResolversTypes['JSONObject']>, ParentType, ContextType>;
  executionId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  jobId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  status?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  step?: Resolver<Maybe<ResolversTypes['Step']>, ParentType, ContextType>;
  stepId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ExecutionStepConnectionResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['ExecutionStepConnection'] = ResolversParentTypes['ExecutionStepConnection']> = {
  edges?: Resolver<Maybe<Array<Maybe<ResolversTypes['ExecutionStepEdge']>>>, ParentType, ContextType>;
  pageInfo?: Resolver<Maybe<ResolversTypes['PageInfo']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ExecutionStepEdgeResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['ExecutionStepEdge'] = ResolversParentTypes['ExecutionStepEdge']> = {
  node?: Resolver<Maybe<ResolversTypes['ExecutionStep']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FieldResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['Field'] = ResolversParentTypes['Field']> = {
  allowArbitrary?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  autoComplete?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  clickToCopy?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  docUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  key?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  label?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  options?: Resolver<Maybe<Array<Maybe<ResolversTypes['ArgumentOption']>>>, ParentType, ContextType>;
  placeholder?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  readOnly?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  required?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  showOptionValue?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  value?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FlowResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['Flow'] = ResolversParentTypes['Flow']> = {
  active?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  createdAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  steps?: Resolver<Maybe<Array<Maybe<ResolversTypes['Step']>>>, ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FlowConnectionResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['FlowConnection'] = ResolversParentTypes['FlowConnection']> = {
  edges?: Resolver<Maybe<Array<Maybe<ResolversTypes['FlowEdge']>>>, ParentType, ContextType>;
  pageInfo?: Resolver<Maybe<ResolversTypes['PageInfo']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FlowEdgeResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['FlowEdge'] = ResolversParentTypes['FlowEdge']> = {
  node?: Resolver<Maybe<ResolversTypes['Flow']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface JSONObjectScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['JSONObject'], any> {
  name: 'JSONObject';
}

export type LoginWithSelectedSgidResultResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['LoginWithSelectedSgidResult'] = ResolversParentTypes['LoginWithSelectedSgidResult']> = {
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type LoginWithSgidResultResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['LoginWithSgidResult'] = ResolversParentTypes['LoginWithSgidResult']> = {
  publicOfficerEmployments?: Resolver<Array<ResolversTypes['SgidPublicOfficerEmployment']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MutationResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  createConnection?: Resolver<Maybe<ResolversTypes['Connection']>, ParentType, ContextType, Partial<MutationcreateConnectionArgs>>;
  createFlow?: Resolver<Maybe<ResolversTypes['Flow']>, ParentType, ContextType, Partial<MutationcreateFlowArgs>>;
  createRow?: Resolver<ResolversTypes['ID'], ParentType, ContextType, RequireFields<MutationcreateRowArgs, 'input'>>;
  createRows?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, RequireFields<MutationcreateRowsArgs, 'input'>>;
  createShareableTableLink?: Resolver<ResolversTypes['String'], ParentType, ContextType, RequireFields<MutationcreateShareableTableLinkArgs, 'tableId'>>;
  createStep?: Resolver<Maybe<ResolversTypes['Step']>, ParentType, ContextType, Partial<MutationcreateStepArgs>>;
  createTable?: Resolver<ResolversTypes['TableMetadata'], ParentType, ContextType, RequireFields<MutationcreateTableArgs, 'input'>>;
  deleteConnection?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationdeleteConnectionArgs>>;
  deleteFlow?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationdeleteFlowArgs>>;
  deleteRows?: Resolver<Array<ResolversTypes['ID']>, ParentType, ContextType, RequireFields<MutationdeleteRowsArgs, 'input'>>;
  deleteStep?: Resolver<Maybe<ResolversTypes['Flow']>, ParentType, ContextType, Partial<MutationdeleteStepArgs>>;
  deleteTable?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationdeleteTableArgs, 'input'>>;
  executeFlow?: Resolver<Maybe<ResolversTypes['ExecuteFlowType']>, ParentType, ContextType, Partial<MutationexecuteFlowArgs>>;
  generateAuthUrl?: Resolver<Maybe<ResolversTypes['AuthLink']>, ParentType, ContextType, Partial<MutationgenerateAuthUrlArgs>>;
  loginWithSelectedSgid?: Resolver<ResolversTypes['LoginWithSelectedSgidResult'], ParentType, ContextType, RequireFields<MutationloginWithSelectedSgidArgs, 'input'>>;
  loginWithSgid?: Resolver<ResolversTypes['LoginWithSgidResult'], ParentType, ContextType, RequireFields<MutationloginWithSgidArgs, 'input'>>;
  logout?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  registerConnection?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationregisterConnectionArgs>>;
  requestOtp?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationrequestOtpArgs>>;
  resetConnection?: Resolver<Maybe<ResolversTypes['Connection']>, ParentType, ContextType, Partial<MutationresetConnectionArgs>>;
  retryExecutionStep?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationretryExecutionStepArgs>>;
  updateConnection?: Resolver<Maybe<ResolversTypes['Connection']>, ParentType, ContextType, Partial<MutationupdateConnectionArgs>>;
  updateFlow?: Resolver<Maybe<ResolversTypes['Flow']>, ParentType, ContextType, Partial<MutationupdateFlowArgs>>;
  updateFlowStatus?: Resolver<Maybe<ResolversTypes['Flow']>, ParentType, ContextType, Partial<MutationupdateFlowStatusArgs>>;
  updateRow?: Resolver<ResolversTypes['ID'], ParentType, ContextType, RequireFields<MutationupdateRowArgs, 'input'>>;
  updateStep?: Resolver<Maybe<ResolversTypes['Step']>, ParentType, ContextType, Partial<MutationupdateStepArgs>>;
  updateTable?: Resolver<ResolversTypes['TableMetadata'], ParentType, ContextType, RequireFields<MutationupdateTableArgs, 'input'>>;
  verifyConnection?: Resolver<Maybe<ResolversTypes['Connection']>, ParentType, ContextType, Partial<MutationverifyConnectionArgs>>;
  verifyOtp?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<MutationverifyOtpArgs>>;
};

export type PageInfoResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['PageInfo'] = ResolversParentTypes['PageInfo']> = {
  currentPage?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QueryResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  getAllRows?: Resolver<Array<ResolversTypes['TileRow']>, ParentType, ContextType, RequireFields<QuerygetAllRowsArgs, 'tableId'>>;
  getApp?: Resolver<Maybe<ResolversTypes['App']>, ParentType, ContextType, RequireFields<QuerygetAppArgs, 'key'>>;
  getApps?: Resolver<Maybe<Array<Maybe<ResolversTypes['App']>>>, ParentType, ContextType, Partial<QuerygetAppsArgs>>;
  getConnectedApps?: Resolver<Maybe<Array<Maybe<ResolversTypes['App']>>>, ParentType, ContextType, Partial<QuerygetConnectedAppsArgs>>;
  getCurrentUser?: Resolver<Maybe<ResolversTypes['User']>, ParentType, UnauthenticatedGraphQLContext>;
  getDynamicData?: Resolver<Maybe<Array<Maybe<ResolversTypes['JSONObject']>>>, ParentType, ContextType, RequireFields<QuerygetDynamicDataArgs, 'key' | 'stepId'>>;
  getExecution?: Resolver<Maybe<ResolversTypes['Execution']>, ParentType, ContextType, RequireFields<QuerygetExecutionArgs, 'executionId'>>;
  getExecutionSteps?: Resolver<Maybe<ResolversTypes['ExecutionStepConnection']>, ParentType, ContextType, RequireFields<QuerygetExecutionStepsArgs, 'executionId' | 'limit' | 'offset'>>;
  getExecutions?: Resolver<Maybe<ResolversTypes['ExecutionConnection']>, ParentType, ContextType, RequireFields<QuerygetExecutionsArgs, 'limit' | 'offset'>>;
  getFlow?: Resolver<Maybe<ResolversTypes['Flow']>, ParentType, ContextType, RequireFields<QuerygetFlowArgs, 'id'>>;
  getFlows?: Resolver<Maybe<ResolversTypes['FlowConnection']>, ParentType, ContextType, RequireFields<QuerygetFlowsArgs, 'limit' | 'offset'>>;
  getStepWithTestExecutions?: Resolver<Maybe<Array<Maybe<ResolversTypes['Step']>>>, ParentType, ContextType, RequireFields<QuerygetStepWithTestExecutionsArgs, 'stepId'>>;
  getTable?: Resolver<ResolversTypes['TableMetadata'], ParentType, ContextType, RequireFields<QuerygetTableArgs, 'tableId'>>;
  getTables?: Resolver<Array<ResolversTypes['TableMetadata']>, ParentType, ContextType>;
  healthcheck?: Resolver<Maybe<ResolversTypes['AppHealth']>, ParentType, ContextType>;
  testConnection?: Resolver<Maybe<ResolversTypes['TestConnectionResult']>, ParentType, ContextType, RequireFields<QuerytestConnectionArgs, 'connectionId'>>;
};

export type ReconnectionStepResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['ReconnectionStep'] = ResolversParentTypes['ReconnectionStep']> = {
  arguments?: Resolver<Maybe<Array<Maybe<ResolversTypes['ReconnectionStepArgument']>>>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ReconnectionStepArgumentResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['ReconnectionStepArgument'] = ResolversParentTypes['ReconnectionStepArgument']> = {
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  properties?: Resolver<Maybe<Array<Maybe<ResolversTypes['ReconnectionStepProperty']>>>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['ArgumentEnumType']>, ParentType, ContextType>;
  value?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ReconnectionStepPropertyResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['ReconnectionStepProperty'] = ResolversParentTypes['ReconnectionStepProperty']> = {
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  value?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SgidPublicOfficerEmploymentResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['SgidPublicOfficerEmployment'] = ResolversParentTypes['SgidPublicOfficerEmployment']> = {
  agencyName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  departmentName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  employmentTitle?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  employmentType?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  workEmail?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type StepResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['Step'] = ResolversParentTypes['Step']> = {
  appKey?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  connection?: Resolver<Maybe<ResolversTypes['Connection']>, ParentType, ContextType>;
  executionSteps?: Resolver<Maybe<Array<Maybe<ResolversTypes['ExecutionStep']>>>, ParentType, ContextType>;
  flow?: Resolver<Maybe<ResolversTypes['Flow']>, ParentType, ContextType>;
  iconUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  key?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  parameters?: Resolver<Maybe<ResolversTypes['JSONObject']>, ParentType, ContextType>;
  position?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  previousStepId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  status?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['StepEnumType']>, ParentType, ContextType>;
  webhookUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TableColumnConfigResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['TableColumnConfig'] = ResolversParentTypes['TableColumnConfig']> = {
  width?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TableColumnMetadataResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['TableColumnMetadata'] = ResolversParentTypes['TableColumnMetadata']> = {
  config?: Resolver<ResolversTypes['TableColumnConfig'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  position?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TableMetadataResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['TableMetadata'] = ResolversParentTypes['TableMetadata']> = {
  columns?: Resolver<Maybe<Array<ResolversTypes['TableColumnMetadata']>>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  lastAccessedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  viewOnlyKey?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TestConnectionResultResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['TestConnectionResult'] = ResolversParentTypes['TestConnectionResult']> = {
  connectionVerified?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  message?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registrationVerified?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TileRowResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['TileRow'] = ResolversParentTypes['TileRow']> = {
  data?: Resolver<ResolversTypes['JSONObject'], ParentType, ContextType>;
  rowId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TriggerResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['Trigger'] = ResolversParentTypes['Trigger']> = {
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  key?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  pollInterval?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  substeps?: Resolver<Maybe<Array<Maybe<ResolversTypes['TriggerSubstep']>>>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  webhookTriggerInstructions?: Resolver<Maybe<ResolversTypes['TriggerInstructions']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TriggerInstructionsResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['TriggerInstructions'] = ResolversParentTypes['TriggerInstructions']> = {
  afterUrlMsg?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  beforeUrlMsg?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  errorMsg?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hideWebhookUrl?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TriggerSubstepResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['TriggerSubstep'] = ResolversParentTypes['TriggerSubstep']> = {
  arguments?: Resolver<Maybe<Array<Maybe<ResolversTypes['TriggerSubstepArgument']>>>, ParentType, ContextType>;
  key?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TriggerSubstepArgumentResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['TriggerSubstepArgument'] = ResolversParentTypes['TriggerSubstepArgument']> = {
  allowArbitrary?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  dependsOn?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  key?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  label?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  options?: Resolver<Maybe<Array<Maybe<ResolversTypes['ArgumentOption']>>>, ParentType, ContextType>;
  placeholder?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  required?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  showOptionValue?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  source?: Resolver<Maybe<ResolversTypes['TriggerSubstepArgumentSource']>, ParentType, ContextType>;
  subFields?: Resolver<Maybe<Array<Maybe<ResolversTypes['TriggerSubstepArgument']>>>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  value?: Resolver<Maybe<ResolversTypes['JSONObject']>, ParentType, ContextType>;
  variableTypes?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  variables?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TriggerSubstepArgumentSourceResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['TriggerSubstepArgumentSource'] = ResolversParentTypes['TriggerSubstepArgumentSource']> = {
  arguments?: Resolver<Maybe<Array<Maybe<ResolversTypes['TriggerSubstepArgumentSourceArgument']>>>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TriggerSubstepArgumentSourceArgumentResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['TriggerSubstepArgumentSourceArgument'] = ResolversParentTypes['TriggerSubstepArgumentSourceArgument']> = {
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  value?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type UserResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = {
  createdAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  email?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = AuthenticatedGraphQLContext> = {
  Action?: ActionResolvers<ContextType>;
  ActionSubstep?: ActionSubstepResolvers<ContextType>;
  ActionSubstepArgument?: ActionSubstepArgumentResolvers<ContextType>;
  ActionSubstepArgumentSource?: ActionSubstepArgumentSourceResolvers<ContextType>;
  ActionSubstepArgumentSourceArgument?: ActionSubstepArgumentSourceArgumentResolvers<ContextType>;
  App?: AppResolvers<ContextType>;
  AppAuth?: AppAuthResolvers<ContextType>;
  AppHealth?: AppHealthResolvers<ContextType>;
  ArgumentOption?: ArgumentOptionResolvers<ContextType>;
  AuthLink?: AuthLinkResolvers<ContextType>;
  AuthenticationStep?: AuthenticationStepResolvers<ContextType>;
  AuthenticationStepArgument?: AuthenticationStepArgumentResolvers<ContextType>;
  AuthenticationStepProperty?: AuthenticationStepPropertyResolvers<ContextType>;
  Connection?: ConnectionResolvers<ContextType>;
  ConnectionData?: ConnectionDataResolvers<ContextType>;
  ExecuteFlowType?: ExecuteFlowTypeResolvers<ContextType>;
  Execution?: ExecutionResolvers<ContextType>;
  ExecutionConnection?: ExecutionConnectionResolvers<ContextType>;
  ExecutionEdge?: ExecutionEdgeResolvers<ContextType>;
  ExecutionStep?: ExecutionStepResolvers<ContextType>;
  ExecutionStepConnection?: ExecutionStepConnectionResolvers<ContextType>;
  ExecutionStepEdge?: ExecutionStepEdgeResolvers<ContextType>;
  Field?: FieldResolvers<ContextType>;
  Flow?: FlowResolvers<ContextType>;
  FlowConnection?: FlowConnectionResolvers<ContextType>;
  FlowEdge?: FlowEdgeResolvers<ContextType>;
  JSONObject?: GraphQLScalarType;
  LoginWithSelectedSgidResult?: LoginWithSelectedSgidResultResolvers<ContextType>;
  LoginWithSgidResult?: LoginWithSgidResultResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  ReconnectionStep?: ReconnectionStepResolvers<ContextType>;
  ReconnectionStepArgument?: ReconnectionStepArgumentResolvers<ContextType>;
  ReconnectionStepProperty?: ReconnectionStepPropertyResolvers<ContextType>;
  SgidPublicOfficerEmployment?: SgidPublicOfficerEmploymentResolvers<ContextType>;
  Step?: StepResolvers<ContextType>;
  TableColumnConfig?: TableColumnConfigResolvers<ContextType>;
  TableColumnMetadata?: TableColumnMetadataResolvers<ContextType>;
  TableMetadata?: TableMetadataResolvers<ContextType>;
  TestConnectionResult?: TestConnectionResultResolvers<ContextType>;
  TileRow?: TileRowResolvers<ContextType>;
  Trigger?: TriggerResolvers<ContextType>;
  TriggerInstructions?: TriggerInstructionsResolvers<ContextType>;
  TriggerSubstep?: TriggerSubstepResolvers<ContextType>;
  TriggerSubstepArgument?: TriggerSubstepArgumentResolvers<ContextType>;
  TriggerSubstepArgumentSource?: TriggerSubstepArgumentSourceResolvers<ContextType>;
  TriggerSubstepArgumentSourceArgument?: TriggerSubstepArgumentSourceArgumentResolvers<ContextType>;
  User?: UserResolvers<ContextType>;
};


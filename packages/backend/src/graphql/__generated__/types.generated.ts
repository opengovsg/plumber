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
  readonly __typename?: 'Action';
  readonly description?: Maybe<Scalars['String']['output']>;
  readonly groupsLaterSteps?: Maybe<Scalars['Boolean']['output']>;
  readonly key?: Maybe<Scalars['String']['output']>;
  readonly name?: Maybe<Scalars['String']['output']>;
  readonly substeps?: Maybe<ReadonlyArray<Maybe<ActionSubstep>>>;
};

export type ActionSubstep = {
  readonly __typename?: 'ActionSubstep';
  readonly arguments?: Maybe<ReadonlyArray<Maybe<ActionSubstepArgument>>>;
  readonly key?: Maybe<Scalars['String']['output']>;
  readonly name?: Maybe<Scalars['String']['output']>;
};

export type ActionSubstepArgument = {
  readonly __typename?: 'ActionSubstepArgument';
  readonly allowArbitrary?: Maybe<Scalars['Boolean']['output']>;
  readonly dependsOn?: Maybe<ReadonlyArray<Maybe<Scalars['String']['output']>>>;
  readonly description?: Maybe<Scalars['String']['output']>;
  readonly hidden?: Maybe<Scalars['Boolean']['output']>;
  readonly key?: Maybe<Scalars['String']['output']>;
  readonly label?: Maybe<Scalars['String']['output']>;
  readonly options?: Maybe<ReadonlyArray<Maybe<ArgumentOption>>>;
  readonly placeholder?: Maybe<Scalars['String']['output']>;
  readonly required?: Maybe<Scalars['Boolean']['output']>;
  readonly showOptionValue?: Maybe<Scalars['Boolean']['output']>;
  readonly source?: Maybe<ActionSubstepArgumentSource>;
  readonly subFields?: Maybe<ReadonlyArray<Maybe<ActionSubstepArgument>>>;
  readonly type?: Maybe<Scalars['String']['output']>;
  readonly value?: Maybe<Scalars['JSONObject']['output']>;
  readonly variableTypes?: Maybe<ReadonlyArray<Maybe<Scalars['String']['output']>>>;
  readonly variables?: Maybe<Scalars['Boolean']['output']>;
};

export type ActionSubstepArgumentSource = {
  readonly __typename?: 'ActionSubstepArgumentSource';
  readonly arguments?: Maybe<ReadonlyArray<Maybe<ActionSubstepArgumentSourceArgument>>>;
  readonly name?: Maybe<Scalars['String']['output']>;
  readonly type?: Maybe<Scalars['String']['output']>;
};

export type ActionSubstepArgumentSourceArgument = {
  readonly __typename?: 'ActionSubstepArgumentSourceArgument';
  readonly name?: Maybe<Scalars['String']['output']>;
  readonly value?: Maybe<Scalars['String']['output']>;
};

export type App = {
  readonly __typename?: 'App';
  readonly actions?: Maybe<ReadonlyArray<Maybe<Action>>>;
  readonly auth?: Maybe<AppAuth>;
  readonly authDocUrl?: Maybe<Scalars['String']['output']>;
  readonly connectionCount?: Maybe<Scalars['Int']['output']>;
  readonly connections?: Maybe<ReadonlyArray<Maybe<Connection>>>;
  readonly description?: Maybe<Scalars['String']['output']>;
  readonly docUrl?: Maybe<Scalars['String']['output']>;
  readonly flowCount?: Maybe<Scalars['Int']['output']>;
  readonly iconUrl?: Maybe<Scalars['String']['output']>;
  readonly key?: Maybe<Scalars['String']['output']>;
  readonly name?: Maybe<Scalars['String']['output']>;
  readonly primaryColor?: Maybe<Scalars['String']['output']>;
  readonly triggers?: Maybe<ReadonlyArray<Maybe<Trigger>>>;
};

export type AppAuth = {
  readonly __typename?: 'AppAuth';
  readonly authenticationSteps?: Maybe<ReadonlyArray<Maybe<AuthenticationStep>>>;
  readonly connectionRegistrationType?: Maybe<Scalars['String']['output']>;
  readonly connectionType: Scalars['String']['output'];
  readonly fields?: Maybe<ReadonlyArray<Maybe<Field>>>;
  readonly reconnectionSteps?: Maybe<ReadonlyArray<Maybe<ReconnectionStep>>>;
};

export type AppHealth = {
  readonly __typename?: 'AppHealth';
  readonly version?: Maybe<Scalars['String']['output']>;
};

export type ArgumentEnumType =
  | 'integer'
  | 'string';

export type ArgumentOption = {
  readonly __typename?: 'ArgumentOption';
  readonly label?: Maybe<Scalars['String']['output']>;
  readonly value?: Maybe<Scalars['JSONObject']['output']>;
};

export type AuthLink = {
  readonly __typename?: 'AuthLink';
  readonly url?: Maybe<Scalars['String']['output']>;
};

export type AuthenticationStep = {
  readonly __typename?: 'AuthenticationStep';
  readonly arguments?: Maybe<ReadonlyArray<Maybe<AuthenticationStepArgument>>>;
  readonly name?: Maybe<Scalars['String']['output']>;
  readonly type?: Maybe<Scalars['String']['output']>;
};

export type AuthenticationStepArgument = {
  readonly __typename?: 'AuthenticationStepArgument';
  readonly name?: Maybe<Scalars['String']['output']>;
  readonly properties?: Maybe<ReadonlyArray<Maybe<AuthenticationStepProperty>>>;
  readonly type?: Maybe<ArgumentEnumType>;
  readonly value?: Maybe<Scalars['String']['output']>;
};

export type AuthenticationStepProperty = {
  readonly __typename?: 'AuthenticationStepProperty';
  readonly name?: Maybe<Scalars['String']['output']>;
  readonly value?: Maybe<Scalars['String']['output']>;
};

export type Connection = {
  readonly __typename?: 'Connection';
  readonly app?: Maybe<App>;
  readonly createdAt?: Maybe<Scalars['String']['output']>;
  readonly flowCount?: Maybe<Scalars['Int']['output']>;
  readonly formattedData?: Maybe<ConnectionData>;
  readonly id?: Maybe<Scalars['String']['output']>;
  readonly key?: Maybe<Scalars['String']['output']>;
  readonly verified?: Maybe<Scalars['Boolean']['output']>;
};

export type ConnectionData = {
  readonly __typename?: 'ConnectionData';
  readonly screenName?: Maybe<Scalars['String']['output']>;
};

export type CreateConnectionInput = {
  readonly formattedData: Scalars['JSONObject']['input'];
  readonly key: Scalars['String']['input'];
};

export type CreateFlowInput = {
  readonly connectionId?: InputMaybe<Scalars['String']['input']>;
  readonly triggerAppKey?: InputMaybe<Scalars['String']['input']>;
};

export type CreateStepInput = {
  readonly appKey?: InputMaybe<Scalars['String']['input']>;
  readonly connection?: InputMaybe<StepConnectionInput>;
  readonly flow?: InputMaybe<StepFlowInput>;
  readonly id?: InputMaybe<Scalars['String']['input']>;
  readonly key?: InputMaybe<Scalars['String']['input']>;
  readonly parameters?: InputMaybe<Scalars['JSONObject']['input']>;
  readonly previousStep?: InputMaybe<PreviousStepInput>;
  readonly previousStepId?: InputMaybe<Scalars['String']['input']>;
};

export type CreateTableInput = {
  readonly name: Scalars['String']['input'];
};

export type CreateTableRowInput = {
  readonly data: Scalars['JSONObject']['input'];
  readonly tableId: Scalars['ID']['input'];
};

export type CreateTableRowsInput = {
  readonly dataArray: ReadonlyArray<Scalars['JSONObject']['input']>;
  readonly tableId: Scalars['ID']['input'];
};

export type DeleteConnectionInput = {
  readonly id: Scalars['String']['input'];
};

export type DeleteFlowInput = {
  readonly id: Scalars['String']['input'];
};

export type DeleteStepInput = {
  readonly ids: ReadonlyArray<Scalars['String']['input']>;
};

export type DeleteTableInput = {
  readonly id: Scalars['ID']['input'];
};

export type DeleteTableRowsInput = {
  readonly rowIds: ReadonlyArray<Scalars['ID']['input']>;
  readonly tableId: Scalars['ID']['input'];
};

export type ExecuteFlowInput = {
  readonly stepId: Scalars['String']['input'];
};

export type ExecuteFlowType = {
  readonly __typename?: 'ExecuteFlowType';
  readonly data?: Maybe<Scalars['JSONObject']['output']>;
  readonly step?: Maybe<Step>;
};

export type Execution = {
  readonly __typename?: 'Execution';
  readonly createdAt?: Maybe<Scalars['String']['output']>;
  readonly flow?: Maybe<Flow>;
  readonly id?: Maybe<Scalars['String']['output']>;
  readonly status?: Maybe<Scalars['String']['output']>;
  readonly testRun?: Maybe<Scalars['Boolean']['output']>;
  readonly updatedAt?: Maybe<Scalars['String']['output']>;
};

export type ExecutionConnection = {
  readonly __typename?: 'ExecutionConnection';
  readonly edges?: Maybe<ReadonlyArray<Maybe<ExecutionEdge>>>;
  readonly pageInfo?: Maybe<PageInfo>;
};

export type ExecutionEdge = {
  readonly __typename?: 'ExecutionEdge';
  readonly node?: Maybe<Execution>;
};

export type ExecutionStep = {
  readonly __typename?: 'ExecutionStep';
  readonly appKey?: Maybe<Scalars['String']['output']>;
  readonly createdAt?: Maybe<Scalars['String']['output']>;
  readonly dataIn?: Maybe<Scalars['JSONObject']['output']>;
  readonly dataOut?: Maybe<Scalars['JSONObject']['output']>;
  readonly dataOutMetadata?: Maybe<Scalars['JSONObject']['output']>;
  readonly errorDetails?: Maybe<Scalars['JSONObject']['output']>;
  readonly executionId?: Maybe<Scalars['String']['output']>;
  readonly id?: Maybe<Scalars['String']['output']>;
  readonly jobId?: Maybe<Scalars['String']['output']>;
  readonly status?: Maybe<Scalars['String']['output']>;
  readonly step?: Maybe<Step>;
  readonly stepId?: Maybe<Scalars['String']['output']>;
  readonly updatedAt?: Maybe<Scalars['String']['output']>;
};

export type ExecutionStepConnection = {
  readonly __typename?: 'ExecutionStepConnection';
  readonly edges?: Maybe<ReadonlyArray<Maybe<ExecutionStepEdge>>>;
  readonly pageInfo?: Maybe<PageInfo>;
};

export type ExecutionStepEdge = {
  readonly __typename?: 'ExecutionStepEdge';
  readonly node?: Maybe<ExecutionStep>;
};

export type Field = {
  readonly __typename?: 'Field';
  readonly allowArbitrary?: Maybe<Scalars['Boolean']['output']>;
  readonly autoComplete?: Maybe<Scalars['String']['output']>;
  readonly clickToCopy?: Maybe<Scalars['Boolean']['output']>;
  readonly description?: Maybe<Scalars['String']['output']>;
  readonly docUrl?: Maybe<Scalars['String']['output']>;
  readonly key?: Maybe<Scalars['String']['output']>;
  readonly label?: Maybe<Scalars['String']['output']>;
  readonly options?: Maybe<ReadonlyArray<Maybe<ArgumentOption>>>;
  readonly placeholder?: Maybe<Scalars['String']['output']>;
  readonly readOnly?: Maybe<Scalars['Boolean']['output']>;
  readonly required?: Maybe<Scalars['Boolean']['output']>;
  readonly showOptionValue?: Maybe<Scalars['Boolean']['output']>;
  readonly type?: Maybe<Scalars['String']['output']>;
  readonly value?: Maybe<Scalars['String']['output']>;
};

export type Flow = {
  readonly __typename?: 'Flow';
  readonly active?: Maybe<Scalars['Boolean']['output']>;
  readonly createdAt?: Maybe<Scalars['String']['output']>;
  readonly id?: Maybe<Scalars['String']['output']>;
  readonly name?: Maybe<Scalars['String']['output']>;
  readonly steps?: Maybe<ReadonlyArray<Maybe<Step>>>;
  readonly updatedAt?: Maybe<Scalars['String']['output']>;
};

export type FlowConnection = {
  readonly __typename?: 'FlowConnection';
  readonly edges?: Maybe<ReadonlyArray<Maybe<FlowEdge>>>;
  readonly pageInfo?: Maybe<PageInfo>;
};

export type FlowEdge = {
  readonly __typename?: 'FlowEdge';
  readonly node?: Maybe<Flow>;
};

export type GenerateAuthUrlInput = {
  readonly id: Scalars['String']['input'];
};

export type LoginWithSelectedSgidInput = {
  readonly workEmail: Scalars['String']['input'];
};

export type LoginWithSelectedSgidResult = {
  readonly __typename?: 'LoginWithSelectedSgidResult';
  readonly success: Scalars['Boolean']['output'];
};

export type LoginWithSgidInput = {
  readonly authCode: Scalars['String']['input'];
  readonly nonce: Scalars['String']['input'];
  readonly verifier: Scalars['String']['input'];
};

export type LoginWithSgidResult = {
  readonly __typename?: 'LoginWithSgidResult';
  readonly publicOfficerEmployments: ReadonlyArray<SgidPublicOfficerEmployment>;
};

export type Mutation = {
  readonly __typename?: 'Mutation';
  readonly createConnection?: Maybe<Connection>;
  readonly createFlow?: Maybe<Flow>;
  readonly createRow: Scalars['ID']['output'];
  readonly createRows?: Maybe<Scalars['Boolean']['output']>;
  readonly createShareableTableLink: Scalars['String']['output'];
  readonly createStep?: Maybe<Step>;
  readonly createTable: TableMetadata;
  readonly deleteConnection?: Maybe<Scalars['Boolean']['output']>;
  readonly deleteFlow?: Maybe<Scalars['Boolean']['output']>;
  readonly deleteRows: ReadonlyArray<Scalars['ID']['output']>;
  readonly deleteStep?: Maybe<Flow>;
  readonly deleteTable: Scalars['Boolean']['output'];
  readonly executeFlow?: Maybe<ExecuteFlowType>;
  readonly generateAuthUrl?: Maybe<AuthLink>;
  readonly loginWithSelectedSgid: LoginWithSelectedSgidResult;
  readonly loginWithSgid: LoginWithSgidResult;
  readonly logout?: Maybe<Scalars['Boolean']['output']>;
  readonly registerConnection?: Maybe<Scalars['Boolean']['output']>;
  readonly requestOtp?: Maybe<Scalars['Boolean']['output']>;
  readonly resetConnection?: Maybe<Connection>;
  readonly retryExecutionStep?: Maybe<Scalars['Boolean']['output']>;
  readonly updateConnection?: Maybe<Connection>;
  readonly updateFlow?: Maybe<Flow>;
  readonly updateFlowStatus?: Maybe<Flow>;
  readonly updateRow: Scalars['ID']['output'];
  readonly updateStep?: Maybe<Step>;
  readonly updateTable: TableMetadata;
  readonly verifyConnection?: Maybe<Connection>;
  readonly verifyOtp?: Maybe<Scalars['Boolean']['output']>;
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
  readonly __typename?: 'PageInfo';
  readonly currentPage: Scalars['Int']['output'];
  readonly totalCount: Scalars['Int']['output'];
};

export type PreviousStepInput = {
  readonly id?: InputMaybe<Scalars['String']['input']>;
};

export type Query = {
  readonly __typename?: 'Query';
  readonly getAllRows: ReadonlyArray<TileRow>;
  readonly getApp?: Maybe<App>;
  readonly getApps?: Maybe<ReadonlyArray<Maybe<App>>>;
  readonly getConnectedApps?: Maybe<ReadonlyArray<Maybe<App>>>;
  readonly getCurrentUser?: Maybe<User>;
  readonly getDynamicData?: Maybe<ReadonlyArray<Maybe<Scalars['JSONObject']['output']>>>;
  readonly getExecution?: Maybe<Execution>;
  readonly getExecutionSteps?: Maybe<ExecutionStepConnection>;
  readonly getExecutions?: Maybe<ExecutionConnection>;
  readonly getFlow?: Maybe<Flow>;
  readonly getFlows?: Maybe<FlowConnection>;
  readonly getStepWithTestExecutions?: Maybe<ReadonlyArray<Maybe<Step>>>;
  readonly getTable: TableMetadata;
  readonly getTables: ReadonlyArray<TableMetadata>;
  readonly healthcheck?: Maybe<AppHealth>;
  readonly testConnection?: Maybe<TestConnectionResult>;
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
  readonly __typename?: 'ReconnectionStep';
  readonly arguments?: Maybe<ReadonlyArray<Maybe<ReconnectionStepArgument>>>;
  readonly name?: Maybe<Scalars['String']['output']>;
  readonly type?: Maybe<Scalars['String']['output']>;
};

export type ReconnectionStepArgument = {
  readonly __typename?: 'ReconnectionStepArgument';
  readonly name?: Maybe<Scalars['String']['output']>;
  readonly properties?: Maybe<ReadonlyArray<Maybe<ReconnectionStepProperty>>>;
  readonly type?: Maybe<ArgumentEnumType>;
  readonly value?: Maybe<Scalars['String']['output']>;
};

export type ReconnectionStepProperty = {
  readonly __typename?: 'ReconnectionStepProperty';
  readonly name?: Maybe<Scalars['String']['output']>;
  readonly value?: Maybe<Scalars['String']['output']>;
};

export type RegisterConnectionInput = {
  readonly connectionId: Scalars['String']['input'];
  readonly stepId?: InputMaybe<Scalars['String']['input']>;
};

export type RequestOtpInput = {
  readonly email: Scalars['String']['input'];
};

export type ResetConnectionInput = {
  readonly id: Scalars['String']['input'];
};

export type RetryExecutionStepInput = {
  readonly executionStepId: Scalars['String']['input'];
};

export type SgidPublicOfficerEmployment = {
  readonly __typename?: 'SgidPublicOfficerEmployment';
  readonly agencyName?: Maybe<Scalars['String']['output']>;
  readonly departmentName?: Maybe<Scalars['String']['output']>;
  readonly employmentTitle?: Maybe<Scalars['String']['output']>;
  readonly employmentType?: Maybe<Scalars['String']['output']>;
  readonly workEmail?: Maybe<Scalars['String']['output']>;
};

export type Step = {
  readonly __typename?: 'Step';
  readonly appKey?: Maybe<Scalars['String']['output']>;
  readonly connection?: Maybe<Connection>;
  readonly executionSteps?: Maybe<ReadonlyArray<Maybe<ExecutionStep>>>;
  readonly flow?: Maybe<Flow>;
  readonly iconUrl?: Maybe<Scalars['String']['output']>;
  readonly id?: Maybe<Scalars['String']['output']>;
  readonly key?: Maybe<Scalars['String']['output']>;
  readonly parameters?: Maybe<Scalars['JSONObject']['output']>;
  readonly position?: Maybe<Scalars['Int']['output']>;
  readonly previousStepId?: Maybe<Scalars['String']['output']>;
  readonly status?: Maybe<Scalars['String']['output']>;
  readonly type?: Maybe<StepEnumType>;
  readonly webhookUrl?: Maybe<Scalars['String']['output']>;
};

export type StepConnectionInput = {
  readonly id?: InputMaybe<Scalars['String']['input']>;
};

export type StepEnumType =
  | 'action'
  | 'trigger';

export type StepFlowInput = {
  readonly id?: InputMaybe<Scalars['String']['input']>;
};

export type StepInput = {
  readonly appKey?: InputMaybe<Scalars['String']['input']>;
  readonly connection?: InputMaybe<StepConnectionInput>;
  readonly flow?: InputMaybe<StepFlowInput>;
  readonly id?: InputMaybe<Scalars['String']['input']>;
  readonly key?: InputMaybe<Scalars['String']['input']>;
  readonly parameters?: InputMaybe<Scalars['JSONObject']['input']>;
  readonly previousStep?: InputMaybe<PreviousStepInput>;
  readonly previousStepId?: InputMaybe<Scalars['String']['input']>;
};

export type TableColumnConfig = {
  readonly __typename?: 'TableColumnConfig';
  readonly width?: Maybe<Scalars['Int']['output']>;
};

export type TableColumnConfigInput = {
  readonly width?: InputMaybe<Scalars['Int']['input']>;
};

export type TableColumnMetadata = {
  readonly __typename?: 'TableColumnMetadata';
  readonly config: TableColumnConfig;
  readonly id: Scalars['ID']['output'];
  readonly name: Scalars['String']['output'];
  readonly position: Scalars['Int']['output'];
};

export type TableColumnMetadataInput = {
  readonly config?: InputMaybe<TableColumnConfigInput>;
  readonly id: Scalars['ID']['input'];
  readonly name?: InputMaybe<Scalars['String']['input']>;
  readonly position?: InputMaybe<Scalars['Int']['input']>;
};

export type TableMetadata = {
  readonly __typename?: 'TableMetadata';
  readonly columns?: Maybe<ReadonlyArray<TableColumnMetadata>>;
  readonly id: Scalars['ID']['output'];
  readonly lastAccessedAt: Scalars['String']['output'];
  readonly name: Scalars['String']['output'];
  readonly viewOnlyKey?: Maybe<Scalars['String']['output']>;
};

export type TestConnectionResult = {
  readonly __typename?: 'TestConnectionResult';
  readonly connectionVerified: Scalars['Boolean']['output'];
  readonly message?: Maybe<Scalars['String']['output']>;
  readonly registrationVerified?: Maybe<Scalars['Boolean']['output']>;
};

export type TileRow = {
  readonly __typename?: 'TileRow';
  readonly data: Scalars['JSONObject']['output'];
  readonly rowId: Scalars['ID']['output'];
};

export type Trigger = {
  readonly __typename?: 'Trigger';
  readonly description?: Maybe<Scalars['String']['output']>;
  readonly key?: Maybe<Scalars['String']['output']>;
  readonly name?: Maybe<Scalars['String']['output']>;
  readonly pollInterval?: Maybe<Scalars['Int']['output']>;
  readonly substeps?: Maybe<ReadonlyArray<Maybe<TriggerSubstep>>>;
  readonly type?: Maybe<Scalars['String']['output']>;
  readonly webhookTriggerInstructions?: Maybe<TriggerInstructions>;
};

export type TriggerInstructions = {
  readonly __typename?: 'TriggerInstructions';
  readonly afterUrlMsg?: Maybe<Scalars['String']['output']>;
  readonly beforeUrlMsg?: Maybe<Scalars['String']['output']>;
  readonly errorMsg?: Maybe<Scalars['String']['output']>;
  readonly hideWebhookUrl?: Maybe<Scalars['Boolean']['output']>;
};

export type TriggerSubstep = {
  readonly __typename?: 'TriggerSubstep';
  readonly arguments?: Maybe<ReadonlyArray<Maybe<TriggerSubstepArgument>>>;
  readonly key?: Maybe<Scalars['String']['output']>;
  readonly name?: Maybe<Scalars['String']['output']>;
};

export type TriggerSubstepArgument = {
  readonly __typename?: 'TriggerSubstepArgument';
  readonly allowArbitrary?: Maybe<Scalars['Boolean']['output']>;
  readonly dependsOn?: Maybe<ReadonlyArray<Maybe<Scalars['String']['output']>>>;
  readonly description?: Maybe<Scalars['String']['output']>;
  readonly key?: Maybe<Scalars['String']['output']>;
  readonly label?: Maybe<Scalars['String']['output']>;
  readonly options?: Maybe<ReadonlyArray<Maybe<ArgumentOption>>>;
  readonly placeholder?: Maybe<Scalars['String']['output']>;
  readonly required?: Maybe<Scalars['Boolean']['output']>;
  readonly showOptionValue?: Maybe<Scalars['Boolean']['output']>;
  readonly source?: Maybe<TriggerSubstepArgumentSource>;
  readonly subFields?: Maybe<ReadonlyArray<Maybe<TriggerSubstepArgument>>>;
  readonly type?: Maybe<Scalars['String']['output']>;
  readonly value?: Maybe<Scalars['JSONObject']['output']>;
  readonly variableTypes?: Maybe<ReadonlyArray<Maybe<Scalars['String']['output']>>>;
  readonly variables?: Maybe<Scalars['Boolean']['output']>;
};

export type TriggerSubstepArgumentSource = {
  readonly __typename?: 'TriggerSubstepArgumentSource';
  readonly arguments?: Maybe<ReadonlyArray<Maybe<TriggerSubstepArgumentSourceArgument>>>;
  readonly name?: Maybe<Scalars['String']['output']>;
  readonly type?: Maybe<Scalars['String']['output']>;
};

export type TriggerSubstepArgumentSourceArgument = {
  readonly __typename?: 'TriggerSubstepArgumentSourceArgument';
  readonly name?: Maybe<Scalars['String']['output']>;
  readonly value?: Maybe<Scalars['String']['output']>;
};

export type UpdateConnectionInput = {
  readonly formattedData: Scalars['JSONObject']['input'];
  readonly id: Scalars['String']['input'];
};

export type UpdateFlowInput = {
  readonly id: Scalars['String']['input'];
  readonly name: Scalars['String']['input'];
};

export type UpdateFlowStatusInput = {
  readonly active: Scalars['Boolean']['input'];
  readonly id: Scalars['String']['input'];
};

export type UpdateStepInput = {
  readonly appKey?: InputMaybe<Scalars['String']['input']>;
  readonly connection?: InputMaybe<StepConnectionInput>;
  readonly flow?: InputMaybe<StepFlowInput>;
  readonly id?: InputMaybe<Scalars['String']['input']>;
  readonly key?: InputMaybe<Scalars['String']['input']>;
  readonly parameters?: InputMaybe<Scalars['JSONObject']['input']>;
  readonly previousStep?: InputMaybe<PreviousStepInput>;
  readonly previousStepId?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateTableInput = {
  readonly addedColumns?: InputMaybe<ReadonlyArray<Scalars['String']['input']>>;
  readonly deletedColumns?: InputMaybe<ReadonlyArray<Scalars['ID']['input']>>;
  readonly id: Scalars['ID']['input'];
  readonly modifiedColumns?: InputMaybe<ReadonlyArray<TableColumnMetadataInput>>;
  readonly name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateTableRowInput = {
  readonly data: Scalars['JSONObject']['input'];
  readonly rowId: Scalars['ID']['input'];
  readonly tableId: Scalars['ID']['input'];
};

export type User = {
  readonly __typename?: 'User';
  readonly createdAt?: Maybe<Scalars['String']['output']>;
  readonly email?: Maybe<Scalars['String']['output']>;
  readonly id?: Maybe<Scalars['String']['output']>;
  readonly updatedAt?: Maybe<Scalars['String']['output']>;
};

export type VerifyConnectionInput = {
  readonly id: Scalars['String']['input'];
};

export type VerifyOtpInput = {
  readonly email: Scalars['String']['input'];
  readonly otp: Scalars['String']['input'];
};



export type ResolverTypeWrapper<T> = Promise<T> | T;

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
  Flow: ResolverTypeWrapper<Omit<Flow, 'steps'> & { steps?: Maybe<ReadonlyArray<Maybe<ResolversTypes['Step']>>> }>;
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
  Step: ResolverTypeWrapper<Omit<Step, 'connection' | 'executionSteps' | 'flow'> & { connection?: Maybe<ResolversTypes['Connection']>, executionSteps?: Maybe<ReadonlyArray<Maybe<ResolversTypes['ExecutionStep']>>>, flow?: Maybe<ResolversTypes['Flow']> }>;
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
  Flow: Omit<Flow, 'steps'> & { steps?: Maybe<ReadonlyArray<Maybe<ResolversParentTypes['Step']>>> };
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
  Step: Omit<Step, 'connection' | 'executionSteps' | 'flow'> & { connection?: Maybe<ResolversParentTypes['Connection']>, executionSteps?: Maybe<ReadonlyArray<Maybe<ResolversParentTypes['ExecutionStep']>>>, flow?: Maybe<ResolversParentTypes['Flow']> };
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
  substeps?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['ActionSubstep']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ActionSubstepResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['ActionSubstep'] = ResolversParentTypes['ActionSubstep']> = {
  arguments?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['ActionSubstepArgument']>>>, ParentType, ContextType>;
  key?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ActionSubstepArgumentResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['ActionSubstepArgument'] = ResolversParentTypes['ActionSubstepArgument']> = {
  allowArbitrary?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  dependsOn?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hidden?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  key?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  label?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  options?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['ArgumentOption']>>>, ParentType, ContextType>;
  placeholder?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  required?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  showOptionValue?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  source?: Resolver<Maybe<ResolversTypes['ActionSubstepArgumentSource']>, ParentType, ContextType>;
  subFields?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['ActionSubstepArgument']>>>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  value?: Resolver<Maybe<ResolversTypes['JSONObject']>, ParentType, ContextType>;
  variableTypes?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  variables?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ActionSubstepArgumentSourceResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['ActionSubstepArgumentSource'] = ResolversParentTypes['ActionSubstepArgumentSource']> = {
  arguments?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['ActionSubstepArgumentSourceArgument']>>>, ParentType, ContextType>;
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
  actions?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['Action']>>>, ParentType, ContextType>;
  auth?: Resolver<Maybe<ResolversTypes['AppAuth']>, ParentType, ContextType>;
  authDocUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  connectionCount?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  connections?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['Connection']>>>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  docUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  flowCount?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  iconUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  key?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  primaryColor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  triggers?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['Trigger']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AppAuthResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['AppAuth'] = ResolversParentTypes['AppAuth']> = {
  authenticationSteps?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['AuthenticationStep']>>>, ParentType, ContextType>;
  connectionRegistrationType?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  connectionType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  fields?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['Field']>>>, ParentType, ContextType>;
  reconnectionSteps?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['ReconnectionStep']>>>, ParentType, ContextType>;
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
  arguments?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['AuthenticationStepArgument']>>>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AuthenticationStepArgumentResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['AuthenticationStepArgument'] = ResolversParentTypes['AuthenticationStepArgument']> = {
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  properties?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['AuthenticationStepProperty']>>>, ParentType, ContextType>;
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
  edges?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['ExecutionEdge']>>>, ParentType, ContextType>;
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
  edges?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['ExecutionStepEdge']>>>, ParentType, ContextType>;
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
  options?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['ArgumentOption']>>>, ParentType, ContextType>;
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
  steps?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['Step']>>>, ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FlowConnectionResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['FlowConnection'] = ResolversParentTypes['FlowConnection']> = {
  edges?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['FlowEdge']>>>, ParentType, ContextType>;
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
  publicOfficerEmployments?: Resolver<ReadonlyArray<ResolversTypes['SgidPublicOfficerEmployment']>, ParentType, ContextType>;
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
  deleteRows?: Resolver<ReadonlyArray<ResolversTypes['ID']>, ParentType, ContextType, RequireFields<MutationdeleteRowsArgs, 'input'>>;
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
  getAllRows?: Resolver<ReadonlyArray<ResolversTypes['TileRow']>, ParentType, ContextType, RequireFields<QuerygetAllRowsArgs, 'tableId'>>;
  getApp?: Resolver<Maybe<ResolversTypes['App']>, ParentType, ContextType, RequireFields<QuerygetAppArgs, 'key'>>;
  getApps?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['App']>>>, ParentType, ContextType, Partial<QuerygetAppsArgs>>;
  getConnectedApps?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['App']>>>, ParentType, ContextType, Partial<QuerygetConnectedAppsArgs>>;
  getCurrentUser?: Resolver<Maybe<ResolversTypes['User']>, ParentType, UnauthenticatedGraphQLContext>;
  getDynamicData?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['JSONObject']>>>, ParentType, ContextType, RequireFields<QuerygetDynamicDataArgs, 'key' | 'stepId'>>;
  getExecution?: Resolver<Maybe<ResolversTypes['Execution']>, ParentType, ContextType, RequireFields<QuerygetExecutionArgs, 'executionId'>>;
  getExecutionSteps?: Resolver<Maybe<ResolversTypes['ExecutionStepConnection']>, ParentType, ContextType, RequireFields<QuerygetExecutionStepsArgs, 'executionId' | 'limit' | 'offset'>>;
  getExecutions?: Resolver<Maybe<ResolversTypes['ExecutionConnection']>, ParentType, ContextType, RequireFields<QuerygetExecutionsArgs, 'limit' | 'offset'>>;
  getFlow?: Resolver<Maybe<ResolversTypes['Flow']>, ParentType, ContextType, RequireFields<QuerygetFlowArgs, 'id'>>;
  getFlows?: Resolver<Maybe<ResolversTypes['FlowConnection']>, ParentType, ContextType, RequireFields<QuerygetFlowsArgs, 'limit' | 'offset'>>;
  getStepWithTestExecutions?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['Step']>>>, ParentType, ContextType, RequireFields<QuerygetStepWithTestExecutionsArgs, 'stepId'>>;
  getTable?: Resolver<ResolversTypes['TableMetadata'], ParentType, ContextType, RequireFields<QuerygetTableArgs, 'tableId'>>;
  getTables?: Resolver<ReadonlyArray<ResolversTypes['TableMetadata']>, ParentType, ContextType>;
  healthcheck?: Resolver<Maybe<ResolversTypes['AppHealth']>, ParentType, ContextType>;
  testConnection?: Resolver<Maybe<ResolversTypes['TestConnectionResult']>, ParentType, ContextType, RequireFields<QuerytestConnectionArgs, 'connectionId'>>;
};

export type ReconnectionStepResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['ReconnectionStep'] = ResolversParentTypes['ReconnectionStep']> = {
  arguments?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['ReconnectionStepArgument']>>>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ReconnectionStepArgumentResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['ReconnectionStepArgument'] = ResolversParentTypes['ReconnectionStepArgument']> = {
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  properties?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['ReconnectionStepProperty']>>>, ParentType, ContextType>;
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
  executionSteps?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['ExecutionStep']>>>, ParentType, ContextType>;
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
  columns?: Resolver<Maybe<ReadonlyArray<ResolversTypes['TableColumnMetadata']>>, ParentType, ContextType>;
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
  substeps?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['TriggerSubstep']>>>, ParentType, ContextType>;
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
  arguments?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['TriggerSubstepArgument']>>>, ParentType, ContextType>;
  key?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TriggerSubstepArgumentResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['TriggerSubstepArgument'] = ResolversParentTypes['TriggerSubstepArgument']> = {
  allowArbitrary?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  dependsOn?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  key?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  label?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  options?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['ArgumentOption']>>>, ParentType, ContextType>;
  placeholder?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  required?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  showOptionValue?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  source?: Resolver<Maybe<ResolversTypes['TriggerSubstepArgumentSource']>, ParentType, ContextType>;
  subFields?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['TriggerSubstepArgument']>>>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  value?: Resolver<Maybe<ResolversTypes['JSONObject']>, ParentType, ContextType>;
  variableTypes?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  variables?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TriggerSubstepArgumentSourceResolvers<ContextType = AuthenticatedGraphQLContext, ParentType extends ResolversParentTypes['TriggerSubstepArgumentSource'] = ResolversParentTypes['TriggerSubstepArgumentSource']> = {
  arguments?: Resolver<Maybe<ReadonlyArray<Maybe<ResolversTypes['TriggerSubstepArgumentSourceArgument']>>>, ParentType, ContextType>;
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


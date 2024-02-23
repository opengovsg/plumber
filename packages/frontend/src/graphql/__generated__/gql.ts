/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 */
const documents = {
    "\n  mutation CreateConnection($input: CreateConnectionInput) {\n    createConnection(input: $input) {\n      id\n      key\n      verified\n      formattedData {\n        screenName\n      }\n    }\n  }\n": types.CreateConnectionDocument,
    "\n  mutation CreateFlow($input: CreateFlowInput) {\n    createFlow(input: $input) {\n      id\n      name\n    }\n  }\n": types.CreateFlowDocument,
    "\n  mutation CreateRow($input: CreateTableRowInput!) {\n    createRow(input: $input)\n  }\n": types.CreateRowDocument,
    "\n  mutation CreateRows($input: CreateTableRowsInput!) {\n    createRows(input: $input)\n  }\n": types.CreateRowsDocument,
    "\n  mutation CreateShareableTableLink($tableId: ID!) {\n    createShareableTableLink(tableId: $tableId)\n  }\n": types.CreateShareableTableLinkDocument,
    "\n  mutation CreateStep($input: CreateStepInput) {\n    createStep(input: $input) {\n      id\n      type\n      key\n      appKey\n      parameters\n      position\n      status\n      connection {\n        id\n      }\n    }\n  }\n": types.CreateStepDocument,
    "\n  mutation CreateTable($input: CreateTableInput!) {\n    createTable(input: $input) {\n      id\n      name\n    }\n  }\n": types.CreateTableDocument,
    "\n  mutation DeleteConnection($input: DeleteConnectionInput) {\n    deleteConnection(input: $input)\n  }\n": types.DeleteConnectionDocument,
    "\n  mutation DeleteFlow($input: DeleteFlowInput) {\n    deleteFlow(input: $input)\n  }\n": types.DeleteFlowDocument,
    "\n  mutation DeleteRows($input: DeleteTableRowsInput!) {\n    deleteRows(input: $input)\n  }\n": types.DeleteRowsDocument,
    "\n  mutation DeleteStep($input: DeleteStepInput) {\n    deleteStep(input: $input) {\n      id\n      steps {\n        id\n      }\n    }\n  }\n": types.DeleteStepDocument,
    "\n  mutation DeleteTable($input: DeleteTableInput!) {\n    deleteTable(input: $input)\n  }\n": types.DeleteTableDocument,
    "\n  mutation ExecuteFlow($input: ExecuteFlowInput) {\n    executeFlow(input: $input) {\n      step {\n        id\n        status\n        appKey\n        executionSteps {\n          id\n          executionId\n          stepId\n          status\n          dataOut\n          dataOutMetadata\n        }\n      }\n      data\n    }\n  }\n": types.ExecuteFlowDocument,
    "\n  mutation generateAuthUrl($input: GenerateAuthUrlInput) {\n    generateAuthUrl(input: $input) {\n      url\n    }\n  }\n": types.GenerateAuthUrlDocument,
    "\n  mutation LoginWithSelectedSgid($input: LoginWithSelectedSgidInput!) {\n    loginWithSelectedSgid(input: $input) {\n      success\n    }\n  }\n": types.LoginWithSelectedSgidDocument,
    "\n  mutation LoginWithSgid($input: LoginWithSgidInput!) {\n    loginWithSgid(input: $input) {\n      publicOfficerEmployments {\n        workEmail\n        agencyName\n        departmentName\n        employmentTitle\n      }\n    }\n  }\n": types.LoginWithSgidDocument,
    "\n  mutation Logout {\n    logout\n  }\n": types.LogoutDocument,
    "\n  mutation RegisterConnection($input: RegisterConnectionInput) {\n    registerConnection(input: $input)\n  }\n": types.RegisterConnectionDocument,
    "\n  mutation RequestOtp($input: RequestOtpInput) {\n    requestOtp(input: $input)\n  }\n": types.RequestOtpDocument,
    "\n  mutation ResetConnection($input: ResetConnectionInput) {\n    resetConnection(input: $input) {\n      id\n    }\n  }\n": types.ResetConnectionDocument,
    "\n  mutation RetryExecutionStep($input: RetryExecutionStepInput) {\n    retryExecutionStep(input: $input)\n  }\n": types.RetryExecutionStepDocument,
    "\n  mutation UpdateConnection($input: UpdateConnectionInput) {\n    updateConnection(input: $input) {\n      id\n      key\n      verified\n      formattedData {\n        screenName\n      }\n    }\n  }\n": types.UpdateConnectionDocument,
    "\n  mutation UpdateFlowStatus($input: UpdateFlowStatusInput) {\n    updateFlowStatus(input: $input) {\n      id\n      active\n    }\n  }\n": types.UpdateFlowStatusDocument,
    "\n  mutation UpdateFlow($input: UpdateFlowInput) {\n    updateFlow(input: $input) {\n      id\n      name\n    }\n  }\n": types.UpdateFlowDocument,
    "\n  mutation UpdateRow($input: UpdateTableRowInput!) {\n    updateRow(input: $input)\n  }\n": types.UpdateRowDocument,
    "\n  mutation UpdateStep($input: UpdateStepInput) {\n    updateStep(input: $input) {\n      id\n      type\n      key\n      appKey\n      webhookUrl\n      parameters\n      status\n      connection {\n        id\n      }\n    }\n  }\n": types.UpdateStepDocument,
    "\n  mutation UpdateTable($input: UpdateTableInput!) {\n    updateTable(input: $input) {\n      id\n    }\n  }\n": types.UpdateTableDocument,
    "\n  mutation VerifyConnection($input: VerifyConnectionInput) {\n    verifyConnection(input: $input) {\n      id\n      key\n      verified\n      formattedData {\n        screenName\n      }\n      createdAt\n      app {\n        key\n      }\n    }\n  }\n": types.VerifyConnectionDocument,
    "\n  mutation VerifyOtp($input: VerifyOtpInput) {\n    verifyOtp(input: $input)\n  }\n": types.VerifyOtpDocument,
    "\n  query GetAllRows($tableId: String!) {\n    getAllRows(tableId: $tableId) {\n      rowId\n      data\n    }\n  }\n": types.GetAllRowsDocument,
    "\n  query GetAppConnections($key: String!) {\n    getApp(key: $key) {\n      key\n      connections {\n        id\n        key\n        verified\n        flowCount\n        formattedData {\n          screenName\n        }\n        createdAt\n      }\n    }\n  }\n": types.GetAppConnectionsDocument,
    "\n  query GetApp($key: String!) {\n    getApp(key: $key) {\n      name\n      key\n      iconUrl\n      docUrl\n      authDocUrl\n      primaryColor\n      auth {\n        connectionType\n        connectionRegistrationType\n        fields {\n          key\n          label\n          type\n          required\n          readOnly\n          value\n          description\n          docUrl\n          allowArbitrary\n          clickToCopy\n          autoComplete\n          options {\n            label\n            value\n          }\n        }\n        authenticationSteps {\n          type\n          name\n          arguments {\n            name\n            value\n            type\n            properties {\n              name\n              value\n            }\n          }\n        }\n        reconnectionSteps {\n          type\n          name\n          arguments {\n            name\n            value\n            type\n            properties {\n              name\n              value\n            }\n          }\n        }\n      }\n      connections {\n        id\n      }\n      triggers {\n        name\n        key\n        type\n        pollInterval\n        description\n        substeps {\n          name\n        }\n      }\n      actions {\n        name\n        key\n        description\n        substeps {\n          name\n        }\n      }\n    }\n  }\n": types.GetAppDocument,
    "\n  query GetApps(\n    $name: String\n    $onlyWithTriggers: Boolean\n    $onlyWithActions: Boolean\n  ) {\n    getApps(\n      name: $name\n      onlyWithTriggers: $onlyWithTriggers\n      onlyWithActions: $onlyWithActions\n    ) {\n      name\n      key\n      iconUrl\n      docUrl\n      authDocUrl\n      primaryColor\n      connectionCount\n      description\n      auth {\n        connectionType\n        connectionRegistrationType\n        fields {\n          key\n          label\n          type\n          required\n          readOnly\n          value\n          placeholder\n          description\n          docUrl\n          clickToCopy\n          autoComplete\n          options {\n            label\n            value\n          }\n        }\n        authenticationSteps {\n          type\n          name\n          arguments {\n            name\n            value\n            type\n            properties {\n              name\n              value\n            }\n          }\n        }\n        reconnectionSteps {\n          type\n          name\n          arguments {\n            name\n            value\n            type\n            properties {\n              name\n              value\n            }\n          }\n        }\n      }\n      triggers {\n        name\n        key\n        type\n        pollInterval\n        description\n        webhookTriggerInstructions {\n          beforeUrlMsg\n          afterUrlMsg\n          errorMsg\n          hideWebhookUrl\n        }\n        substeps {\n          key\n          name\n          arguments {\n            label\n            key\n            type\n            required\n            description\n            placeholder\n            variables\n            variableTypes\n            allowArbitrary\n            dependsOn\n            value\n            showOptionValue\n            options {\n              label\n              value\n            }\n            source {\n              type\n              name\n              arguments {\n                name\n                value\n              }\n            }\n            # Only for multi-row\n            subFields {\n              label\n              key\n              type\n              required\n              description\n              placeholder\n              variables\n              variableTypes\n              allowArbitrary\n              dependsOn\n              showOptionValue\n              options {\n                label\n                value\n              }\n              source {\n                type\n                name\n                arguments {\n                  name\n                  value\n                }\n              }\n            }\n          }\n        }\n      }\n      actions {\n        name\n        key\n        description\n        groupsLaterSteps\n        substeps {\n          key\n          name\n          arguments {\n            label\n            key\n            type\n            required\n            description\n            placeholder\n            variables\n            variableTypes\n            allowArbitrary\n            dependsOn\n            hidden\n            showOptionValue\n            value\n            options {\n              label\n              value\n            }\n            source {\n              type\n              name\n              arguments {\n                name\n                value\n              }\n            }\n            # Only for multi-row\n            subFields {\n              label\n              key\n              type\n              required\n              description\n              placeholder\n              variables\n              variableTypes\n              allowArbitrary\n              dependsOn\n              showOptionValue\n              options {\n                label\n                value\n              }\n              source {\n                type\n                name\n                arguments {\n                  name\n                  value\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n": types.GetAppsDocument,
    "\n  query GetConnectedApps($name: String) {\n    getConnectedApps(name: $name) {\n      key\n      name\n      iconUrl\n      docUrl\n      primaryColor\n      connectionCount\n      flowCount\n      auth {\n        connectionType\n      }\n    }\n  }\n": types.GetConnectedAppsDocument,
    "\n  query GetCurrentUser {\n    getCurrentUser {\n      id\n      email\n      createdAt\n      updatedAt\n    }\n  }\n": types.GetCurrentUserDocument,
    "\n  query GetDynamicData(\n    $stepId: String!\n    $key: String!\n    $parameters: JSONObject\n  ) {\n    getDynamicData(stepId: $stepId, key: $key, parameters: $parameters)\n  }\n": types.GetDynamicDataDocument,
    "\n  query GetExecutionSteps($executionId: String!, $limit: Int!, $offset: Int!) {\n    getExecutionSteps(\n      executionId: $executionId\n      limit: $limit\n      offset: $offset\n    ) {\n      pageInfo {\n        currentPage\n        totalCount\n      }\n      edges {\n        node {\n          id\n          executionId\n          status\n          dataIn\n          dataOut\n          errorDetails\n          createdAt\n          updatedAt\n          jobId\n          appKey\n        }\n      }\n    }\n  }\n": types.GetExecutionStepsDocument,
    "\n  query GetExecution($executionId: String!) {\n    getExecution(executionId: $executionId) {\n      id\n      testRun\n      createdAt\n      updatedAt\n      flow {\n        id\n        name\n        active\n      }\n    }\n  }\n": types.GetExecutionDocument,
    "\n  query GetExecutions(\n    $limit: Int!\n    $offset: Int!\n    $status: String\n    $searchInput: String\n  ) {\n    getExecutions(\n      limit: $limit\n      offset: $offset\n      status: $status\n      searchInput: $searchInput\n    ) {\n      pageInfo {\n        currentPage\n        totalCount\n      }\n      edges {\n        node {\n          id\n          testRun\n          createdAt\n          updatedAt\n          status\n          flow {\n            id\n            name\n            active\n            steps {\n              iconUrl\n            }\n          }\n        }\n      }\n    }\n  }\n": types.GetExecutionsDocument,
    "\n  query GetFlow($id: String!) {\n    getFlow(id: $id) {\n      id\n      name\n      active\n      steps {\n        id\n        type\n        key\n        appKey\n        iconUrl\n        webhookUrl\n        status\n        position\n        connection {\n          id\n          verified\n          createdAt\n        }\n        parameters\n      }\n    }\n  }\n": types.GetFlowDocument,
    "\n  query GetFlows(\n    $limit: Int!\n    $offset: Int!\n    $appKey: String\n    $connectionId: String\n    $name: String\n  ) {\n    getFlows(\n      limit: $limit\n      offset: $offset\n      appKey: $appKey\n      connectionId: $connectionId\n      name: $name\n    ) {\n      pageInfo {\n        currentPage\n        totalCount\n      }\n      edges {\n        node {\n          id\n          name\n          createdAt\n          updatedAt\n          active\n          steps {\n            iconUrl\n          }\n        }\n      }\n    }\n  }\n": types.GetFlowsDocument,
    "\n  query GetStepWithTestExecutions($stepId: String!) {\n    getStepWithTestExecutions(stepId: $stepId) {\n      id\n      appKey\n      executionSteps {\n        id\n        executionId\n        stepId\n        status\n        dataOut\n        dataOutMetadata\n      }\n    }\n  }\n": types.GetStepWithTestExecutionsDocument,
    "\n  query GetTable($tableId: String!) {\n    getTable(tableId: $tableId) {\n      id\n      name\n      viewOnlyKey\n      columns {\n        id\n        name\n        position\n        config {\n          width\n        }\n      }\n    }\n  }\n": types.GetTableDocument,
    "\n  query GetTables {\n    getTables {\n      id\n      name\n      lastAccessedAt\n    }\n  }\n": types.GetTablesDocument,
    "\n  query Healthcheck {\n    healthcheck {\n      version\n    }\n  }\n": types.HealthcheckDocument,
    "\n  query TestConnection($connectionId: String!, $stepId: String) {\n    testConnection(connectionId: $connectionId, stepId: $stepId) {\n      connectionVerified\n      registrationVerified\n      message\n    }\n  }\n": types.TestConnectionDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateConnection($input: CreateConnectionInput) {\n    createConnection(input: $input) {\n      id\n      key\n      verified\n      formattedData {\n        screenName\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation CreateConnection($input: CreateConnectionInput) {\n    createConnection(input: $input) {\n      id\n      key\n      verified\n      formattedData {\n        screenName\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateFlow($input: CreateFlowInput) {\n    createFlow(input: $input) {\n      id\n      name\n    }\n  }\n"): (typeof documents)["\n  mutation CreateFlow($input: CreateFlowInput) {\n    createFlow(input: $input) {\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateRow($input: CreateTableRowInput!) {\n    createRow(input: $input)\n  }\n"): (typeof documents)["\n  mutation CreateRow($input: CreateTableRowInput!) {\n    createRow(input: $input)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateRows($input: CreateTableRowsInput!) {\n    createRows(input: $input)\n  }\n"): (typeof documents)["\n  mutation CreateRows($input: CreateTableRowsInput!) {\n    createRows(input: $input)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateShareableTableLink($tableId: ID!) {\n    createShareableTableLink(tableId: $tableId)\n  }\n"): (typeof documents)["\n  mutation CreateShareableTableLink($tableId: ID!) {\n    createShareableTableLink(tableId: $tableId)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateStep($input: CreateStepInput) {\n    createStep(input: $input) {\n      id\n      type\n      key\n      appKey\n      parameters\n      position\n      status\n      connection {\n        id\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation CreateStep($input: CreateStepInput) {\n    createStep(input: $input) {\n      id\n      type\n      key\n      appKey\n      parameters\n      position\n      status\n      connection {\n        id\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateTable($input: CreateTableInput!) {\n    createTable(input: $input) {\n      id\n      name\n    }\n  }\n"): (typeof documents)["\n  mutation CreateTable($input: CreateTableInput!) {\n    createTable(input: $input) {\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteConnection($input: DeleteConnectionInput) {\n    deleteConnection(input: $input)\n  }\n"): (typeof documents)["\n  mutation DeleteConnection($input: DeleteConnectionInput) {\n    deleteConnection(input: $input)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteFlow($input: DeleteFlowInput) {\n    deleteFlow(input: $input)\n  }\n"): (typeof documents)["\n  mutation DeleteFlow($input: DeleteFlowInput) {\n    deleteFlow(input: $input)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteRows($input: DeleteTableRowsInput!) {\n    deleteRows(input: $input)\n  }\n"): (typeof documents)["\n  mutation DeleteRows($input: DeleteTableRowsInput!) {\n    deleteRows(input: $input)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteStep($input: DeleteStepInput) {\n    deleteStep(input: $input) {\n      id\n      steps {\n        id\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation DeleteStep($input: DeleteStepInput) {\n    deleteStep(input: $input) {\n      id\n      steps {\n        id\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteTable($input: DeleteTableInput!) {\n    deleteTable(input: $input)\n  }\n"): (typeof documents)["\n  mutation DeleteTable($input: DeleteTableInput!) {\n    deleteTable(input: $input)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ExecuteFlow($input: ExecuteFlowInput) {\n    executeFlow(input: $input) {\n      step {\n        id\n        status\n        appKey\n        executionSteps {\n          id\n          executionId\n          stepId\n          status\n          dataOut\n          dataOutMetadata\n        }\n      }\n      data\n    }\n  }\n"): (typeof documents)["\n  mutation ExecuteFlow($input: ExecuteFlowInput) {\n    executeFlow(input: $input) {\n      step {\n        id\n        status\n        appKey\n        executionSteps {\n          id\n          executionId\n          stepId\n          status\n          dataOut\n          dataOutMetadata\n        }\n      }\n      data\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation generateAuthUrl($input: GenerateAuthUrlInput) {\n    generateAuthUrl(input: $input) {\n      url\n    }\n  }\n"): (typeof documents)["\n  mutation generateAuthUrl($input: GenerateAuthUrlInput) {\n    generateAuthUrl(input: $input) {\n      url\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation LoginWithSelectedSgid($input: LoginWithSelectedSgidInput!) {\n    loginWithSelectedSgid(input: $input) {\n      success\n    }\n  }\n"): (typeof documents)["\n  mutation LoginWithSelectedSgid($input: LoginWithSelectedSgidInput!) {\n    loginWithSelectedSgid(input: $input) {\n      success\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation LoginWithSgid($input: LoginWithSgidInput!) {\n    loginWithSgid(input: $input) {\n      publicOfficerEmployments {\n        workEmail\n        agencyName\n        departmentName\n        employmentTitle\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation LoginWithSgid($input: LoginWithSgidInput!) {\n    loginWithSgid(input: $input) {\n      publicOfficerEmployments {\n        workEmail\n        agencyName\n        departmentName\n        employmentTitle\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation Logout {\n    logout\n  }\n"): (typeof documents)["\n  mutation Logout {\n    logout\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RegisterConnection($input: RegisterConnectionInput) {\n    registerConnection(input: $input)\n  }\n"): (typeof documents)["\n  mutation RegisterConnection($input: RegisterConnectionInput) {\n    registerConnection(input: $input)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RequestOtp($input: RequestOtpInput) {\n    requestOtp(input: $input)\n  }\n"): (typeof documents)["\n  mutation RequestOtp($input: RequestOtpInput) {\n    requestOtp(input: $input)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ResetConnection($input: ResetConnectionInput) {\n    resetConnection(input: $input) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation ResetConnection($input: ResetConnectionInput) {\n    resetConnection(input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RetryExecutionStep($input: RetryExecutionStepInput) {\n    retryExecutionStep(input: $input)\n  }\n"): (typeof documents)["\n  mutation RetryExecutionStep($input: RetryExecutionStepInput) {\n    retryExecutionStep(input: $input)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateConnection($input: UpdateConnectionInput) {\n    updateConnection(input: $input) {\n      id\n      key\n      verified\n      formattedData {\n        screenName\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateConnection($input: UpdateConnectionInput) {\n    updateConnection(input: $input) {\n      id\n      key\n      verified\n      formattedData {\n        screenName\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateFlowStatus($input: UpdateFlowStatusInput) {\n    updateFlowStatus(input: $input) {\n      id\n      active\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateFlowStatus($input: UpdateFlowStatusInput) {\n    updateFlowStatus(input: $input) {\n      id\n      active\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateFlow($input: UpdateFlowInput) {\n    updateFlow(input: $input) {\n      id\n      name\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateFlow($input: UpdateFlowInput) {\n    updateFlow(input: $input) {\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateRow($input: UpdateTableRowInput!) {\n    updateRow(input: $input)\n  }\n"): (typeof documents)["\n  mutation UpdateRow($input: UpdateTableRowInput!) {\n    updateRow(input: $input)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateStep($input: UpdateStepInput) {\n    updateStep(input: $input) {\n      id\n      type\n      key\n      appKey\n      webhookUrl\n      parameters\n      status\n      connection {\n        id\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateStep($input: UpdateStepInput) {\n    updateStep(input: $input) {\n      id\n      type\n      key\n      appKey\n      webhookUrl\n      parameters\n      status\n      connection {\n        id\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateTable($input: UpdateTableInput!) {\n    updateTable(input: $input) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateTable($input: UpdateTableInput!) {\n    updateTable(input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation VerifyConnection($input: VerifyConnectionInput) {\n    verifyConnection(input: $input) {\n      id\n      key\n      verified\n      formattedData {\n        screenName\n      }\n      createdAt\n      app {\n        key\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation VerifyConnection($input: VerifyConnectionInput) {\n    verifyConnection(input: $input) {\n      id\n      key\n      verified\n      formattedData {\n        screenName\n      }\n      createdAt\n      app {\n        key\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation VerifyOtp($input: VerifyOtpInput) {\n    verifyOtp(input: $input)\n  }\n"): (typeof documents)["\n  mutation VerifyOtp($input: VerifyOtpInput) {\n    verifyOtp(input: $input)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetAllRows($tableId: String!) {\n    getAllRows(tableId: $tableId) {\n      rowId\n      data\n    }\n  }\n"): (typeof documents)["\n  query GetAllRows($tableId: String!) {\n    getAllRows(tableId: $tableId) {\n      rowId\n      data\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetAppConnections($key: String!) {\n    getApp(key: $key) {\n      key\n      connections {\n        id\n        key\n        verified\n        flowCount\n        formattedData {\n          screenName\n        }\n        createdAt\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetAppConnections($key: String!) {\n    getApp(key: $key) {\n      key\n      connections {\n        id\n        key\n        verified\n        flowCount\n        formattedData {\n          screenName\n        }\n        createdAt\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetApp($key: String!) {\n    getApp(key: $key) {\n      name\n      key\n      iconUrl\n      docUrl\n      authDocUrl\n      primaryColor\n      auth {\n        connectionType\n        connectionRegistrationType\n        fields {\n          key\n          label\n          type\n          required\n          readOnly\n          value\n          description\n          docUrl\n          allowArbitrary\n          clickToCopy\n          autoComplete\n          options {\n            label\n            value\n          }\n        }\n        authenticationSteps {\n          type\n          name\n          arguments {\n            name\n            value\n            type\n            properties {\n              name\n              value\n            }\n          }\n        }\n        reconnectionSteps {\n          type\n          name\n          arguments {\n            name\n            value\n            type\n            properties {\n              name\n              value\n            }\n          }\n        }\n      }\n      connections {\n        id\n      }\n      triggers {\n        name\n        key\n        type\n        pollInterval\n        description\n        substeps {\n          name\n        }\n      }\n      actions {\n        name\n        key\n        description\n        substeps {\n          name\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetApp($key: String!) {\n    getApp(key: $key) {\n      name\n      key\n      iconUrl\n      docUrl\n      authDocUrl\n      primaryColor\n      auth {\n        connectionType\n        connectionRegistrationType\n        fields {\n          key\n          label\n          type\n          required\n          readOnly\n          value\n          description\n          docUrl\n          allowArbitrary\n          clickToCopy\n          autoComplete\n          options {\n            label\n            value\n          }\n        }\n        authenticationSteps {\n          type\n          name\n          arguments {\n            name\n            value\n            type\n            properties {\n              name\n              value\n            }\n          }\n        }\n        reconnectionSteps {\n          type\n          name\n          arguments {\n            name\n            value\n            type\n            properties {\n              name\n              value\n            }\n          }\n        }\n      }\n      connections {\n        id\n      }\n      triggers {\n        name\n        key\n        type\n        pollInterval\n        description\n        substeps {\n          name\n        }\n      }\n      actions {\n        name\n        key\n        description\n        substeps {\n          name\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetApps(\n    $name: String\n    $onlyWithTriggers: Boolean\n    $onlyWithActions: Boolean\n  ) {\n    getApps(\n      name: $name\n      onlyWithTriggers: $onlyWithTriggers\n      onlyWithActions: $onlyWithActions\n    ) {\n      name\n      key\n      iconUrl\n      docUrl\n      authDocUrl\n      primaryColor\n      connectionCount\n      description\n      auth {\n        connectionType\n        connectionRegistrationType\n        fields {\n          key\n          label\n          type\n          required\n          readOnly\n          value\n          placeholder\n          description\n          docUrl\n          clickToCopy\n          autoComplete\n          options {\n            label\n            value\n          }\n        }\n        authenticationSteps {\n          type\n          name\n          arguments {\n            name\n            value\n            type\n            properties {\n              name\n              value\n            }\n          }\n        }\n        reconnectionSteps {\n          type\n          name\n          arguments {\n            name\n            value\n            type\n            properties {\n              name\n              value\n            }\n          }\n        }\n      }\n      triggers {\n        name\n        key\n        type\n        pollInterval\n        description\n        webhookTriggerInstructions {\n          beforeUrlMsg\n          afterUrlMsg\n          errorMsg\n          hideWebhookUrl\n        }\n        substeps {\n          key\n          name\n          arguments {\n            label\n            key\n            type\n            required\n            description\n            placeholder\n            variables\n            variableTypes\n            allowArbitrary\n            dependsOn\n            value\n            showOptionValue\n            options {\n              label\n              value\n            }\n            source {\n              type\n              name\n              arguments {\n                name\n                value\n              }\n            }\n            # Only for multi-row\n            subFields {\n              label\n              key\n              type\n              required\n              description\n              placeholder\n              variables\n              variableTypes\n              allowArbitrary\n              dependsOn\n              showOptionValue\n              options {\n                label\n                value\n              }\n              source {\n                type\n                name\n                arguments {\n                  name\n                  value\n                }\n              }\n            }\n          }\n        }\n      }\n      actions {\n        name\n        key\n        description\n        groupsLaterSteps\n        substeps {\n          key\n          name\n          arguments {\n            label\n            key\n            type\n            required\n            description\n            placeholder\n            variables\n            variableTypes\n            allowArbitrary\n            dependsOn\n            hidden\n            showOptionValue\n            value\n            options {\n              label\n              value\n            }\n            source {\n              type\n              name\n              arguments {\n                name\n                value\n              }\n            }\n            # Only for multi-row\n            subFields {\n              label\n              key\n              type\n              required\n              description\n              placeholder\n              variables\n              variableTypes\n              allowArbitrary\n              dependsOn\n              showOptionValue\n              options {\n                label\n                value\n              }\n              source {\n                type\n                name\n                arguments {\n                  name\n                  value\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetApps(\n    $name: String\n    $onlyWithTriggers: Boolean\n    $onlyWithActions: Boolean\n  ) {\n    getApps(\n      name: $name\n      onlyWithTriggers: $onlyWithTriggers\n      onlyWithActions: $onlyWithActions\n    ) {\n      name\n      key\n      iconUrl\n      docUrl\n      authDocUrl\n      primaryColor\n      connectionCount\n      description\n      auth {\n        connectionType\n        connectionRegistrationType\n        fields {\n          key\n          label\n          type\n          required\n          readOnly\n          value\n          placeholder\n          description\n          docUrl\n          clickToCopy\n          autoComplete\n          options {\n            label\n            value\n          }\n        }\n        authenticationSteps {\n          type\n          name\n          arguments {\n            name\n            value\n            type\n            properties {\n              name\n              value\n            }\n          }\n        }\n        reconnectionSteps {\n          type\n          name\n          arguments {\n            name\n            value\n            type\n            properties {\n              name\n              value\n            }\n          }\n        }\n      }\n      triggers {\n        name\n        key\n        type\n        pollInterval\n        description\n        webhookTriggerInstructions {\n          beforeUrlMsg\n          afterUrlMsg\n          errorMsg\n          hideWebhookUrl\n        }\n        substeps {\n          key\n          name\n          arguments {\n            label\n            key\n            type\n            required\n            description\n            placeholder\n            variables\n            variableTypes\n            allowArbitrary\n            dependsOn\n            value\n            showOptionValue\n            options {\n              label\n              value\n            }\n            source {\n              type\n              name\n              arguments {\n                name\n                value\n              }\n            }\n            # Only for multi-row\n            subFields {\n              label\n              key\n              type\n              required\n              description\n              placeholder\n              variables\n              variableTypes\n              allowArbitrary\n              dependsOn\n              showOptionValue\n              options {\n                label\n                value\n              }\n              source {\n                type\n                name\n                arguments {\n                  name\n                  value\n                }\n              }\n            }\n          }\n        }\n      }\n      actions {\n        name\n        key\n        description\n        groupsLaterSteps\n        substeps {\n          key\n          name\n          arguments {\n            label\n            key\n            type\n            required\n            description\n            placeholder\n            variables\n            variableTypes\n            allowArbitrary\n            dependsOn\n            hidden\n            showOptionValue\n            value\n            options {\n              label\n              value\n            }\n            source {\n              type\n              name\n              arguments {\n                name\n                value\n              }\n            }\n            # Only for multi-row\n            subFields {\n              label\n              key\n              type\n              required\n              description\n              placeholder\n              variables\n              variableTypes\n              allowArbitrary\n              dependsOn\n              showOptionValue\n              options {\n                label\n                value\n              }\n              source {\n                type\n                name\n                arguments {\n                  name\n                  value\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetConnectedApps($name: String) {\n    getConnectedApps(name: $name) {\n      key\n      name\n      iconUrl\n      docUrl\n      primaryColor\n      connectionCount\n      flowCount\n      auth {\n        connectionType\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetConnectedApps($name: String) {\n    getConnectedApps(name: $name) {\n      key\n      name\n      iconUrl\n      docUrl\n      primaryColor\n      connectionCount\n      flowCount\n      auth {\n        connectionType\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetCurrentUser {\n    getCurrentUser {\n      id\n      email\n      createdAt\n      updatedAt\n    }\n  }\n"): (typeof documents)["\n  query GetCurrentUser {\n    getCurrentUser {\n      id\n      email\n      createdAt\n      updatedAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetDynamicData(\n    $stepId: String!\n    $key: String!\n    $parameters: JSONObject\n  ) {\n    getDynamicData(stepId: $stepId, key: $key, parameters: $parameters)\n  }\n"): (typeof documents)["\n  query GetDynamicData(\n    $stepId: String!\n    $key: String!\n    $parameters: JSONObject\n  ) {\n    getDynamicData(stepId: $stepId, key: $key, parameters: $parameters)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetExecutionSteps($executionId: String!, $limit: Int!, $offset: Int!) {\n    getExecutionSteps(\n      executionId: $executionId\n      limit: $limit\n      offset: $offset\n    ) {\n      pageInfo {\n        currentPage\n        totalCount\n      }\n      edges {\n        node {\n          id\n          executionId\n          status\n          dataIn\n          dataOut\n          errorDetails\n          createdAt\n          updatedAt\n          jobId\n          appKey\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetExecutionSteps($executionId: String!, $limit: Int!, $offset: Int!) {\n    getExecutionSteps(\n      executionId: $executionId\n      limit: $limit\n      offset: $offset\n    ) {\n      pageInfo {\n        currentPage\n        totalCount\n      }\n      edges {\n        node {\n          id\n          executionId\n          status\n          dataIn\n          dataOut\n          errorDetails\n          createdAt\n          updatedAt\n          jobId\n          appKey\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetExecution($executionId: String!) {\n    getExecution(executionId: $executionId) {\n      id\n      testRun\n      createdAt\n      updatedAt\n      flow {\n        id\n        name\n        active\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetExecution($executionId: String!) {\n    getExecution(executionId: $executionId) {\n      id\n      testRun\n      createdAt\n      updatedAt\n      flow {\n        id\n        name\n        active\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetExecutions(\n    $limit: Int!\n    $offset: Int!\n    $status: String\n    $searchInput: String\n  ) {\n    getExecutions(\n      limit: $limit\n      offset: $offset\n      status: $status\n      searchInput: $searchInput\n    ) {\n      pageInfo {\n        currentPage\n        totalCount\n      }\n      edges {\n        node {\n          id\n          testRun\n          createdAt\n          updatedAt\n          status\n          flow {\n            id\n            name\n            active\n            steps {\n              iconUrl\n            }\n          }\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetExecutions(\n    $limit: Int!\n    $offset: Int!\n    $status: String\n    $searchInput: String\n  ) {\n    getExecutions(\n      limit: $limit\n      offset: $offset\n      status: $status\n      searchInput: $searchInput\n    ) {\n      pageInfo {\n        currentPage\n        totalCount\n      }\n      edges {\n        node {\n          id\n          testRun\n          createdAt\n          updatedAt\n          status\n          flow {\n            id\n            name\n            active\n            steps {\n              iconUrl\n            }\n          }\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetFlow($id: String!) {\n    getFlow(id: $id) {\n      id\n      name\n      active\n      steps {\n        id\n        type\n        key\n        appKey\n        iconUrl\n        webhookUrl\n        status\n        position\n        connection {\n          id\n          verified\n          createdAt\n        }\n        parameters\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetFlow($id: String!) {\n    getFlow(id: $id) {\n      id\n      name\n      active\n      steps {\n        id\n        type\n        key\n        appKey\n        iconUrl\n        webhookUrl\n        status\n        position\n        connection {\n          id\n          verified\n          createdAt\n        }\n        parameters\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetFlows(\n    $limit: Int!\n    $offset: Int!\n    $appKey: String\n    $connectionId: String\n    $name: String\n  ) {\n    getFlows(\n      limit: $limit\n      offset: $offset\n      appKey: $appKey\n      connectionId: $connectionId\n      name: $name\n    ) {\n      pageInfo {\n        currentPage\n        totalCount\n      }\n      edges {\n        node {\n          id\n          name\n          createdAt\n          updatedAt\n          active\n          steps {\n            iconUrl\n          }\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetFlows(\n    $limit: Int!\n    $offset: Int!\n    $appKey: String\n    $connectionId: String\n    $name: String\n  ) {\n    getFlows(\n      limit: $limit\n      offset: $offset\n      appKey: $appKey\n      connectionId: $connectionId\n      name: $name\n    ) {\n      pageInfo {\n        currentPage\n        totalCount\n      }\n      edges {\n        node {\n          id\n          name\n          createdAt\n          updatedAt\n          active\n          steps {\n            iconUrl\n          }\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetStepWithTestExecutions($stepId: String!) {\n    getStepWithTestExecutions(stepId: $stepId) {\n      id\n      appKey\n      executionSteps {\n        id\n        executionId\n        stepId\n        status\n        dataOut\n        dataOutMetadata\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetStepWithTestExecutions($stepId: String!) {\n    getStepWithTestExecutions(stepId: $stepId) {\n      id\n      appKey\n      executionSteps {\n        id\n        executionId\n        stepId\n        status\n        dataOut\n        dataOutMetadata\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetTable($tableId: String!) {\n    getTable(tableId: $tableId) {\n      id\n      name\n      viewOnlyKey\n      columns {\n        id\n        name\n        position\n        config {\n          width\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetTable($tableId: String!) {\n    getTable(tableId: $tableId) {\n      id\n      name\n      viewOnlyKey\n      columns {\n        id\n        name\n        position\n        config {\n          width\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetTables {\n    getTables {\n      id\n      name\n      lastAccessedAt\n    }\n  }\n"): (typeof documents)["\n  query GetTables {\n    getTables {\n      id\n      name\n      lastAccessedAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Healthcheck {\n    healthcheck {\n      version\n    }\n  }\n"): (typeof documents)["\n  query Healthcheck {\n    healthcheck {\n      version\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TestConnection($connectionId: String!, $stepId: String) {\n    testConnection(connectionId: $connectionId, stepId: $stepId) {\n      connectionVerified\n      registrationVerified\n      message\n    }\n  }\n"): (typeof documents)["\n  query TestConnection($connectionId: String!, $stepId: String) {\n    testConnection(connectionId: $connectionId, stepId: $stepId) {\n      connectionVerified\n      registrationVerified\n      message\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;
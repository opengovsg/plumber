// Needed to break circular import between auth.getSystemAddedConnections and
// main app definition
export const APP_KEY = 'm365-excel'

export const MS_GRAPH_OAUTH_BASE_URL = 'https://login.microsoftonline.com'

// This format is {UUID-VERSION-4}
// Reference: https://stackoverflow.com/questions/7905929/how-to-test-valid-uuid-guid
export const TABLE_ID_WITH_BRACES_REGEX =
  /^\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}$/

// Needed to break circular import between auth.getSystemAddedConnections and
// main app definition
export const APP_KEY = 'm365-excel'

export const MS_GRAPH_OAUTH_BASE_URL = 'https://login.microsoftonline.com'

/**
 * Very loose regex to just accept only alphanumeric characters and dashes
 * since there is no proper public documentation with M365
 */
export const TABLE_ID_REGEX = /^\{[a-zA-Z0-9-]+\}$/ // this include start and end braces
export const FILE_ID_REGEX = /^[a-zA-Z0-9-]+$/

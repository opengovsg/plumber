export const CONNECTIONS = '/connections'
export const EXECUTIONS = '/executions'
export const EXECUTION_PATTERN = '/executions/:executionId'
export const EXECUTION = (executionId: string): string =>
  `/executions/${executionId}`
export const ROOT = '/'

export const FOUR_O_FOUR = '/404'

export const LOGIN = '/login'
export const LOGIN_SGID_REDIRECT = '/login/sgid/redirect'
export const ADD_REDIRECT_TO_LOGIN = (redirectQueryParam: string): string =>
  `${LOGIN}/?redirect=${redirectQueryParam}`

export const APPS = '/apps'
export const APP = (appKey: string): string => `/app/${appKey}`
export const APP_PATTERN = '/app/:appKey'
export const APP_CONNECTIONS = (appKey: string): string =>
  `/app/${appKey}/connections`
export const APP_CONNECTIONS_PATTERN = '/app/:appKey/connections'
export const APP_RECONNECT_CONNECTION = (
  appKey: string,
  connectionId: string,
): string => `/app/${appKey}/connections/${connectionId}/reconnect`
export const APP_RECONNECT_CONNECTION_PATTERN =
  '/app/:appKey/connections/:connectionId/reconnect'
export const APP_FLOWS = (appKey: string): string => `/app/${appKey}/flows`
export const APP_FLOWS_FOR_CONNECTION = (
  appKey: string,
  connectionId: string,
): string => `/app/${appKey}/flows?connectionId=${connectionId}`
export const APP_FLOWS_PATTERN = '/app/:appKey/flows'

export const EDITOR = '/editor'

export const FLOWS = '/flows'
// TODO: revert this back to /flows/:flowId once we have a proper single flow page
export const FLOW = (flowId: string): string => `/editor/${flowId}`
export const FLOW_PATTERN = '/flows/:flowId'

// Tiles routes
export const TILES = '/tiles'
export const TILE = (tableId: string): string => `/tiles/${tableId}`
export const TILE_PATTERN = '/tiles/:tileId'
export const PUBLIC_TILE_PATTERN = '/tiles/:tileId/:viewOnlyKey'
export const UNAUTHORIZED_TILE = '/tiles/unauthorized'

// flow editor: default to flows if flowid is undefined from useParams
export const FLOW_EDITOR = (flowId?: string): string =>
  flowId ? `/editor/${flowId}` : FLOWS
export const FLOW_EDITOR_NOTIFICATIONS = (flowId?: string): string =>
  flowId ? `/editor/${flowId}/notifications` : FLOWS
export const FLOW_EDITOR_TRANSFERS = (flowId?: string): string =>
  flowId ? `/editor/${flowId}/transfer` : FLOWS

export const TRANSFERS = '/transfers'

export const DASHBOARD = FLOWS

export const APP_ICON_URL = (appKey: string): string =>
  `/apps/${appKey}/assets/favicon.svg`

// external links
export const OGP_HOMEPAGE = 'https://open.gov.sg'
export const GUIDE_LINK = 'https://guide.plumber.gov.sg'
export const PRIVACY_STATEMENT_LINK =
  'https://guide.plumber.gov.sg/legal/government-agency-privacy-statement'
export const TERMS_OF_USE_LINK =
  'https://guide.plumber.gov.sg/legal/terms-of-use'
export const FEEDBACK_FORM_LINK = 'https://go.gov.sg/plumber-feedback'
export const STATUS_LINK = 'https://status.plumber.gov.sg/'
export const SGID_CHECK_ELIGIBILITY_URL =
  'https://docs.id.gov.sg/faq-users#as-a-government-officer-why-am-i-not-able-to-login-to-my-work-tool-using-sgid'

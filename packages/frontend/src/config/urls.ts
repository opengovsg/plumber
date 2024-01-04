export const CONNECTIONS = '/connections'
export const EXECUTIONS = '/executions'
export const EXECUTION_PATTERN = '/executions/:executionId'
export const EXECUTION = (executionId: string): string =>
  `/executions/${executionId}`
export const ROOT = '/'

export const LOGIN = '/login'
export const LOGIN_SGID_REDIRECT = '/login/sgid/redirect'
export const ADD_REDIRECT_TO_LOGIN = (redirectQueryParam: string): string =>
  `${LOGIN}/?redirect=${redirectQueryParam}`

export const APPS = '/apps'
export const NEW_APP_CONNECTION = '/apps/new'
export const APP = (appKey: string): string => `/app/${appKey}`
export const APP_PATTERN = '/app/:appKey'
export const APP_CONNECTIONS = (appKey: string): string =>
  `/app/${appKey}/connections`
export const APP_CONNECTIONS_PATTERN = '/app/:appKey/connections'
export const APP_ADD_CONNECTION = (appKey: string): string =>
  `/app/${appKey}/connections/add`
export const APP_ADD_CONNECTION_PATTERN = '/app/:appKey/connections/add'
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
export const CREATE_FLOW = '/editor/create'
export const CREATE_FLOW_WITH_APP = (appKey: string) =>
  `/editor/create?appKey=${appKey}`
export const CREATE_FLOW_WITH_APP_AND_CONNECTION = (
  appKey?: string,
  connectionId?: string,
) => {
  const params: { appKey?: string; connectionId?: string } = {}

  if (appKey) {
    params.appKey = appKey
  }

  if (connectionId) {
    params.connectionId = connectionId
  }

  const searchParams = new URLSearchParams(params).toString()

  return `/editor/create?${searchParams}`
}
export const FLOW_EDITOR = (flowId: string): string => `/editor/${flowId}`

export const FLOWS = '/flows'
// TODO: revert this back to /flows/:flowId once we have a proper single flow page
export const FLOW = (flowId: string): string => `/editor/${flowId}`
export const FLOW_PATTERN = '/flows/:flowId'

export const DASHBOARD = FLOWS

export const APP_ICON_URL = (appKey: string): string =>
  `/apps/${appKey}/assets/favicon.svg`

// external links
export const OGP_HOMEPAGE = 'https://open.gov.sg'
export const GUIDE_LINK = 'https://guide.plumber.gov.sg'
export const FEEDBACK_FORM_LINK = 'https://go.gov.sg/plumber-feedback'
export const STATUS_LINK = 'https://status.plumber.gov.sg/'
export const SGID_CHECK_ELIGIBILITY_URL =
  'https://docs.id.gov.sg/faq-users#as-a-government-officer-why-am-i-not-able-to-login-to-my-work-tool-using-sgid'
export const PLUMBER_AMA_LINK = 'https://go.gov.sg/plumber-ama'

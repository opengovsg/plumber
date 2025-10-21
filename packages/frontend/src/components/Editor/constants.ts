export const EDITOR_MARGIN_TOP_NUM = 61
export const EDITOR_MARGIN_TOP = `${EDITOR_MARGIN_TOP_NUM}px`
export const EDITOR_MAX_HEIGHT = `calc(100vh - ${EDITOR_MARGIN_TOP})`
export const EDITOR_RIGHT_DRAWER_WIDTH = '60%'

export const MIN_FLOW_STEP_WIDTH = '320px'

/**
 * NOTE: there are certain fields that behave like connections
 * such as excel files
 * we do not allow collaborators to edit these fields
 * we use both the label and key as there are some
 * actions that have the same key but use different labels
 */
const NON_EDITABLE_APPS_FIELDS: Record<string, Record<string, string>[]> = {
  'm365-excel': [],
}

export const NON_EDITABLE_APP_CONNECTIONS = Object.keys(
  NON_EDITABLE_APPS_FIELDS,
)

export const NON_EDITABLE_CONNECTION_FIELDS = Object.values(
  NON_EDITABLE_APPS_FIELDS,
).flat()

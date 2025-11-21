export const EDITOR_MARGIN_TOP_NUM = 61
export const EDITOR_MARGIN_TOP = `${EDITOR_MARGIN_TOP_NUM}px`
export const EDITOR_MAX_HEIGHT = `calc(100vh - ${EDITOR_MARGIN_TOP})`
export const EDITOR_RIGHT_DRAWER_WIDTH = '60%'

export const MIN_FLOW_STEP_WIDTH = '320px'

/**
 * Field definition for fields that collaborators cannot add new options for.
 * Each field is identified by both its label and key to handle cases where
 * different actions may share the same key but have different labels.
 */
type RestrictedField = {
  /** display label of the field */
  label: string
  /** key of the field */
  key: string
}

/**
 * Purpose:
 * - Prevents collaborators from modifying connections
 * - Prevents collaborators from adding new options for specified fields
 *
 * Structure:
 * - Key: The app identifier (e.g., 'm365-excel', 'tiles')
 * - Value: Array of fields that collaborators cannot add new options for
 *
 * Any key (app) that is specified here will have its connection fields restricted for collaborators.
 * The value (array of fields) specifies the fields where collaborators cannot add new options.
 *
 * Example:
 * ```
 * {
 *   // collaborators cannot modify the connection, but can perform use all other fields without restrictions
 *   // in this case, the collaborator cannot change the M365-Excel connection,
 *   // but can use all the fields without restrictions
 *   'm365-excel': [],
 *
 *   // collaborators cannot modify the connection,
 *   // collaborators also cannot add new options for these specified fields
 *   // in this case, the collaborator cannot add new tiles inline via the dropdown
 *   'tiles': [
 *     { label: 'Select Tile', key: 'tableId' },
 *   ]
 * }
 * ```
 */
const NON_EDITABLE_APPS_FIELDS: Record<string, RestrictedField[]> = {
  /**
   * M365-Excel
   * collaborators cannot modify the connection, each user can only have one M365-Excel connection.
   */
  'm365-excel': [],

  /**
   * TILES
   * collaborators cannot add new Tiles directly via the dropdown.
   * they can only select from Tiles that the Owner has used in the Pipe.
   */
  tiles: [{ label: 'Select Tile', key: 'tableId' }],
}

export const NON_EDITABLE_APP_CONNECTIONS = Object.keys(
  NON_EDITABLE_APPS_FIELDS,
)

/**
 * Flattened array of all fields where collaborators cannot add new options.
 * This is derived from NON_EDITABLE_APPS_FIELDS and used for quick field-level checks.
 */
export const COLLABORATOR_RESTRICTED_FIELDS = Object.values(
  NON_EDITABLE_APPS_FIELDS,
).flat()

export const NEW_ROW_ID = 'new-row'
export const TEMP_ROW_ID_PREFIX = 'temp-'

export const Z_INDEX = {
  INACTIVE_ROW: 0,
  ACTIVE_ROW: 1,
  NEW_ROW: 2,
  FOOTER: 3,
}

// Used in setTimeout delay, to allow for the browser to render
// This determines the order in which the functions are executed
export const DELAY = {
  FOCUS_CELL: 0,
  SCROLL: 1,
}

// Fixed height need for virtualized list
export const ROW_HEIGHT = {
  DEFAULT: 30,
  EXPANDED: 132,
  FOOTER: 40,
}

export const NEW_COLUMN_ID = 'add-new'
export const SELECT_COLUMN_ID = 'select'

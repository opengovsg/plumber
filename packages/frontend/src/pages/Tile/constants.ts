export const NEW_ROW_ID = 'new-row'
export const TEMP_ROW_ID_PREFIX = 'temp-'

// Used in setTimeout delay, to allow for the browser to render
// This determines the order in which the functions are executed
export const DELAY = {
  FOCUS_CELL: 0,
  SCROLL: 1,
}

// Fixed height need for virtualized list
export const ROW_HEIGHT = {
  DEFAULT: 50,
  EXPANDED: 132,
}

export const NEW_ROW_ID = 'new-row'
export const TEMP_ROW_ID_PREFIX = 'temp-'

export const Z_INDEX = {
  INACTIVE_ROW: 0,
  ACTIVE_ROW: 1,
  NEW_ROW: 3,
  FOOTER: 2,
  HEADER: 10,
}

export const Z_INDEX_CELL = {
  DEFAULT: 0,
  CHECKBOX: 1,
  ACTIVE_CELL: 2,
}

// Used in setTimeout delay, to allow for the browser to render
// This determines the order in which the functions are executed
export const DELAY = {
  FOCUS_CELL: 0,
  SCROLL: 1,
}

// Fixed height need for virtualized list
export const ROW_HEIGHT = {
  DEFAULT: 40,
  EXPANDED: 132,
  HEADER: 40,
  FOOTER: 40,
}

export const NEW_COLUMN_ID = 'add-new'
export const SELECT_COLUMN_ID = 'select'

export const TABLE_BANNER_HEIGHT = '64px'

export const ROW_COLOR = {
  EVEN: 'var(--chakra-colors-secondary-50)',
  ODD: 'white',
  SELECTED: 'var(--chakra-colors-primary-50)',
}

export const HEADER_COLOR = {
  DEFAULT: 'var(--chakra-colors-primary-100)',
  HOVER: 'var(--chakra-colors-primary-200)',
}

export const BORDER_COLOR = {
  DEFAULT: 'var(--chakra-colors-secondary-100)',
  ACTIVE: 'var(--chakra-colors-secondary-200)',
}

// to reduce transition effects
export const POPOVER_MOTION_PROPS = {
  variants: {
    exit: {
      opacity: 0,
      transition: {
        duration: 0,
      },
    },
    enter: {
      opacity: 1,
      transition: {
        duration: 0,
      },
    },
  },
}

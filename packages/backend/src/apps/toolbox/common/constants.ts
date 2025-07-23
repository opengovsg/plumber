export const FOR_EACH_ITERATION_KEY = '__ITERATION__'
export enum FOR_EACH_INPUT_SOURCE {
  M365_EXCEL = 'm365-excel',
  TILES = 'tiles',
  STRING_ARRAY = 'string-array',
  FORMSG_TABLE = 'formsg-table',
}

export const FOR_EACH_ITERATION_DELAY = 2000 // in ms
export const FOR_EACH_MAX_ITERATIONS = 500
export const TOOLBOX_APP_KEY = 'toolbox'
export enum TOOLBOX_ACTIONS {
  FOR_EACH = 'forEach',
  IF_THEN = 'ifThen',
}

export const FOR_EACH_TABLE_SOURCES = [
  FOR_EACH_INPUT_SOURCE.TILES,
  FOR_EACH_INPUT_SOURCE.M365_EXCEL,
  FOR_EACH_INPUT_SOURCE.FORMSG_TABLE,
]

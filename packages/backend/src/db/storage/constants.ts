export const FORMSG_SAMPLE_URL_DESCRIPTION = 'View a sample form'
export const TILES_SAMPLE_URL_DESCRIPTION = 'View a sample table'

// placeholder keys to be used for the placeholder replacement map
export const USER_EMAIL_KEY = 'user_email'
export const TILE_ID_KEY = 'tile_table_id'
export const TILE_COL_DATA_KEY = 'tile_col_data'
export const STEP_ID_KEY = (position: number) => `step_id_${position}`

/**
 * These placeholders are constructed by the respective keys above
 * e.g. user_email becomes <<user_email>>
 * nested placeholders could exist e.g. <<tile_col_data.email>>
 * Create your own placeholder here if you have additional ones
 */
export const USER_EMAIL_PLACEHOLDER = `<<${USER_EMAIL_KEY}>>`
export const TILE_ID_PLACEHOLDER = `<<${TILE_ID_KEY}>>`
export const TILE_COL_DATA_PLACEHOLDER = (colName: string) =>
  `<<${TILE_COL_DATA_KEY}.${colName}>>`
export const STEP_ID_PLACEHOLDER = (position: number) =>
  `<<${STEP_ID_KEY(position)}>>`

/**
 * Some templates require a step variable which follows the format of
 * our step i.e. {{step.step_id.label}}
 * If the step variable does not need to take reference to a previous step,
 * so we fill the step id with the placeholder template step id
 * since no step data is required.
 */
const PLACEHOLDER_TEMPLATE_STEP_ID = '00000000-0000-0000-0000-000000000000'
export const CREATE_TEMPLATE_STEP_VARIABLE = (
  varLabel: string,
  position?: number,
) => {
  // note that most step variable will be empty so a standard/fake step id is used
  if (!position) {
    return `{{step.${PLACEHOLDER_TEMPLATE_STEP_ID}.${varLabel}}}`
  }
  return `{{step.${STEP_ID_PLACEHOLDER(position)}.${varLabel}}}`
}

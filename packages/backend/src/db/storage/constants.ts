export const FORMSG_SAMPLE_URL_DESCRIPTION = 'View a sample form'
export const TILES_SAMPLE_URL_DESCRIPTION = 'View a sample table'

// placeholders for each template step to be replaced
export const USER_EMAIL_PLACEHOLDER = 'user_email'
export const TILE_ID_PLACEHOLDER = 'tile_table_id'
export const TILE_COL_DATA_PLACEHOLDER = 'tile_col_data'
export const STEP_ID_PLACEHOLDER = (position: number) => `step_id_${position}`

// construct template placeholders e.g. <<placeholder>>
const PLACEHOLDER_TEMPLATE_STEP_ID = '00000000-0000-0000-0000-000000000000'
export const CREATE_TEMPLATE_STEP_VARIABLE = (
  varLabel: string,
  position?: number,
) => {
  // note that most step variable will be empty so a standard/fake step id is used
  if (!position) {
    return `{{step.${PLACEHOLDER_TEMPLATE_STEP_ID}.${varLabel}}}`
  }
  return `{{step.<<${STEP_ID_PLACEHOLDER(position)}>>.${varLabel}}}`
}
export const CREATE_TEMPLATE_PLACEHOLDER = (
  placeholderKey: string,
  nestedKey?: string,
) => {
  if (nestedKey) {
    return `<<${placeholderKey}.${nestedKey}>>` // for nested placeholders
  }
  return `<<${placeholderKey}>>`
}

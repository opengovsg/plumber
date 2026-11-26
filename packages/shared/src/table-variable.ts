// Rendering a table variable costs rows × selected columns, so both are capped.
export const MAX_TABLE_VARIABLE_COLUMNS = 100
export const MAX_TABLE_VARIABLE_ROWS = 500
// Shared by every table variable in one step, since one email body can hold
// many tables. Bounds the HTML that the email sanitiser and execution log handle.
export const MAX_TABLE_VARIABLE_BYTES_PER_STEP = 10 * 1024 * 1024

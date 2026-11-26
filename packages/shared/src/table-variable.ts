// Rendering a table variable costs rows × selected columns, so both are capped.
export const MAX_TABLE_VARIABLE_COLUMNS = 100
export const MAX_TABLE_VARIABLE_ROWS = 500
// Shared by every table variable in one step, since one email body can hold
// many tables. Each table also pays for its header row.
export const MAX_TABLE_VARIABLE_CELLS_PER_STEP = 100_000

// Rendering a table variable costs rows × selected columns, so both are capped.
export const MAX_TABLE_VARIABLE_COLUMNS = 100
export const MAX_TABLE_VARIABLE_ROWS = 500
// Shared by every table variable in one field, since one email body can hold
// many tables. Real bodies peak at 13,500 cells.
export const MAX_TABLE_VARIABLE_CELLS_PER_FIELD = 100_000

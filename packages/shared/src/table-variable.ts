// Table variables render every row for every selected column, so both are
// capped. Real tables peak at 99 columns and at the 500-row limit that Tiles
// and M365 Excel already apply.
export const MAX_TABLE_VARIABLE_COLUMNS = 100
export const MAX_TABLE_VARIABLE_ROWS = 500

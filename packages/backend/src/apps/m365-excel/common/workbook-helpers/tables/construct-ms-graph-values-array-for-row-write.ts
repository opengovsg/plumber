interface ColumnToWrite {
  columnName: string
  value: string
}

/**
 * When writing values to a table row, MS Graph expects these values to be an
 * array of the same length as the number of columns in the table, with values
 * in the same order as their corresponding column index.
 *
 * This format is inconvenient for us, as our row update data is often unordered
 * (e.g. multirow). This function helps convert our data to MS's expected
 * format.
 *
 * @param tableColumns An ordered array of all columns in the table.
 * @param newValues An array of columns to write to, and the values to write
 *                  (typically obtained from multirow action arguments).
 * @returns An array suitable for use in MS's Graph API.
 */
export function constructMsGraphValuesArrayForRowWrite(
  tableColumns: string[],
  columnsToWrite: ColumnToWrite[],
): Array<string | null> {
  const columnNameToIndex = new Map(
    // Excel itself doesn't allow duplicate column names, so we don't need to
    // worry about key conflicts in this map.
    tableColumns.map((name, index) => [name, index]),
  )

  const result: Array<string | null> = new Array(tableColumns.length).fill(null)
  for (const columnToWrite of columnsToWrite) {
    const index = columnNameToIndex.get(columnToWrite.columnName)

    if (index === undefined) {
      throw new Error(
        `Column "${columnToWrite.columnName}" does not exist in your table. Remove this column from 'Row Data' section to proceed.`,
      )
    }

    result[index] = columnToWrite.value
  }

  return result
}

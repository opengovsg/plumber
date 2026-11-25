import { FOR_EACH_INPUT_SOURCE } from '@/apps/toolbox/common/constants'

import { extractLastTopLevelBracketContent } from './get-data-out-metadata'

type TableColumn = {
  id: string
  label: string
  name: string
  value: string
}

const createColumn = (label: string, index: number): TableColumn => {
  const id = Buffer.from(`Col ${index + 1}`).toString('hex')
  return {
    // NOTE: we keep this ID so that it still works even if the user tested
    // the step with mock data previously
    id,
    label,
    name: label,
    value: `data.rows.*.data.${id}`,
  }
}

function parseColumnNames(question: string): string[] {
  const { content: columnNames } = extractLastTopLevelBracketContent(question)
  return columnNames ? columnNames.split(',').map((name) => name.trim()) : []
}

/**
 * @param columnTitles Schema column titles. The question suffix cannot be
 * parsed when a title has an unmatched bracket.
 */
export default function convertTableAnswerArrayToTableObject(
  question: string,
  answerArray: string[][],
  columnTitles?: string[],
) {
  const columnNamesArray = columnTitles ?? parseColumnNames(question)
  const firstRow = answerArray[0]

  const columns =
    // A blank table has no row to measure, so titles come from the question.
    !firstRow
      ? columnNamesArray.map((column, index) => createColumn(column, index))
      : // make sure that column names do not contain commas
        columnNamesArray.length === firstRow.length
        ? columnNamesArray.map((column, index) => createColumn(column, index))
        : firstRow.map((_, index) => createColumn(`Col ${index + 1}`, index))

  /**
   * NOTE: we do not show table rows that do not have any data
   */
  const rows = (answerArray as string[][])
    .filter((row) => !row.every((v) => v === ''))
    .map((row) => {
      const rowData: Record<string, string | number> = {}
      row.forEach((v: string, i: number) => {
        rowData[columns[i].id] = v.replaceAll('\u0000', '')
      })
      return { data: rowData }
    })

  return JSON.stringify({
    rows,
    columns,
    inputSource: FOR_EACH_INPUT_SOURCE.FORMSG_TABLE,
  })
}

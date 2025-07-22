import { FOR_EACH_INPUT_SOURCE } from '@/apps/toolbox/common/constants'

import { extractLastTopLevelBracketContent } from '../triggers/new-submission/get-data-out-metadata'

type TableColumn = {
  id: string
  label: string
  name: string
  value: string
}

const createColumn = (label: string): TableColumn => {
  const id = Buffer.from(label).toString('hex')
  return {
    id,
    label,
    name: label,
    value: `data.rows.*.data.${id}`,
  }
}

export default function convertTableAnswerArrayToTableObject(
  question: string,
  answerArray: string[][],
) {
  const { content: columnNames } = extractLastTopLevelBracketContent(question)
  const columnNamesArray = columnNames.split(',').map((name) => name.trim())

  const columns =
    // make sure that column names do not contain commas
    columnNamesArray.length === answerArray[0].length
      ? columnNamesArray.map(createColumn)
      : answerArray[0].map((_, index) => createColumn(`Column ${index + 1}`))

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

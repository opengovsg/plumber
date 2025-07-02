import { FOR_EACH_INPUT_SOURCE } from '@/apps/toolbox/common/constants'

export default function convertTableAnswerArrayToTableObject(
  answerArray: string[][],
) {
  const columns = (answerArray[0] as string[]).map(
    (_: string, index: number) => {
      const label = `Column ${index + 1}`
      return {
        id: Buffer.from(label).toString('hex'),
        label,
        name: label,
        value: `data.rows.*.data.${Buffer.from(label).toString('hex')}`,
      }
    },
  )

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

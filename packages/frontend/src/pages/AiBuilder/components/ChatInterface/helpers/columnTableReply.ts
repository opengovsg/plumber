import type { ColumnTableData } from '@/hooks/useChatStream'

export interface EditableColumnRow {
  id: string
  name: string
  value: string
  checked: boolean
}

export function buildEditableRows(data: ColumnTableData): EditableColumnRow[] {
  return data.rows.map((row) => ({
    id: row.id,
    name: row.name,
    value: row.draft,
    checked: row.include,
  }))
}

export function buildColumnTableReply(
  question: string,
  rows: EditableColumnRow[],
): string {
  const checked = rows.filter((row) => row.checked)

  if (checked.length === 0) {
    return `Q: ${question}\nA: none`
  }

  const lines = checked.map(
    (row) => `- ${row.name} (id: ${row.id}): ${row.value}`,
  )

  return `Q: ${question}\nA:\n${lines.join('\n')}`
}

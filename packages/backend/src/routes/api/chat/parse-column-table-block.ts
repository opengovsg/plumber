import { z } from 'zod'

export interface ColumnTableRow {
  id: string
  name: string
  draft: string
  include: boolean
}

export interface ColumnTableData {
  question: string
  stepId: string
  field: string
  rows: ColumnTableRow[]
}

const stepIdSchema = z.uuid()

// Each group is non-greedy, but that's not what lets a value contain a comma
// (e.g. a NAME of "Last, First") — the literal field-keyword anchors that
// follow (", DRAFT:", ", INCLUDE:") are what stop the match at the right
// place, regardless of greediness.
const ROW_LINE_REGEX =
  /^-\s*ID:\s*(.*?),\s*NAME:\s*(.*?),\s*DRAFT:\s*(.*?),\s*INCLUDE:\s*(true|false)\s*$/i

export function parseColumnTableBlock(text: string): ColumnTableData | null {
  const match = text.match(/<!--\s*COLUMN_TABLE_DATA\s*([\s\S]*?)\s*-->/)
  if (!match) {
    return null
  }

  const lines = match[1]
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  let question = ''
  let stepId = ''
  let field = ''
  const rows: ColumnTableRow[] = []

  for (const line of lines) {
    if (line.startsWith('Q:')) {
      question = line.slice(2).trim()
    } else if (line.startsWith('STEP_ID:')) {
      stepId = line.slice('STEP_ID:'.length).trim()
    } else if (line.startsWith('FIELD:')) {
      field = line.slice('FIELD:'.length).trim()
    } else if (line.startsWith('-')) {
      const rowMatch = line.match(ROW_LINE_REGEX)
      if (!rowMatch) {
        continue
      }
      const [, id, name, draft, include] = rowMatch
      rows.push({
        id: id.trim(),
        name: name.trim(),
        draft: draft.trim(),
        include: include.toLowerCase() === 'true',
      })
    }
  }

  if (
    !question ||
    !stepIdSchema.safeParse(stepId).success ||
    !field ||
    rows.length === 0
  ) {
    return null
  }

  return { question, stepId, field, rows }
}

import type { TileSetupData } from '@/hooks/useChatStream'

export function buildTileSetupReply(
  question: string,
  name: string | null,
  columns: string[],
): string {
  const trimmedColumns = columns.map((column) => column.trim()).filter(Boolean)
  const lines = [`Q: ${question}`, 'A:']
  if (name !== null) {
    lines.push(`NAME: ${name.trim()}`)
  }
  lines.push('COLUMNS:')
  for (const column of trimmedColumns) {
    lines.push(`- ${column}`)
  }
  return lines.join('\n')
}

export function initialTileSetupState(data: TileSetupData): {
  name: string | null
  columns: string[]
} {
  return {
    name: data.name,
    columns: data.columns.length ? [...data.columns] : [''],
  }
}

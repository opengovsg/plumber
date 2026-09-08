export interface TileSetupData {
  question: string
  name: string | null
  columns: string[]
}

export function parseTileSetupBlock(text: string): TileSetupData | null {
  const match = text.match(/<!--\s*TILE_SETUP_DATA\s*([\s\S]*?)\s*-->/)
  if (!match) {
    return null
  }

  const lines = match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  let question = ''
  let name: string | null = null
  let inColumns = false
  const columns: string[] = []

  for (const line of lines) {
    if (line.startsWith('Q:')) {
      question = line.slice(2).trim()
      inColumns = false
    } else if (line.startsWith('NAME:')) {
      name = line.slice('NAME:'.length).trim()
      inColumns = false
    } else if (line === 'COLUMNS:') {
      inColumns = true
    } else if (inColumns && line.startsWith('-')) {
      const columnName = line.slice(1).trim()
      if (columnName) {
        columns.push(columnName)
      }
    }
  }

  if (!question || columns.length === 0) {
    return null
  }

  return { question, name, columns }
}

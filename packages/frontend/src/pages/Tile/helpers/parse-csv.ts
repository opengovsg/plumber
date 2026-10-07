import Papa, { type ParseError, type ParseResult } from 'papaparse'

// A blank header would create a column with no name.
export function transformTileCsvHeader(header: string): string {
  return header.trim() || '(empty)'
}

export const tileCsvParseConfig = {
  transformHeader: transformTileCsvHeader,
  header: true as const,
  skipEmptyLines: true as const,
}

/**
 * Papa Parse still returns field names when quotes are broken.
 * Those names must not become tile columns.
 */
const QUOTE_ERROR_CODES = new Set<ParseError['code']>([
  'MissingQuotes',
  'InvalidQuotes',
])

export type TileCsvParse =
  | { ok: true; rows: Record<string, string>[]; columns: string[] }
  | { ok: false; error: string }

export function interpretTileCsvParseResult(
  parseResult: ParseResult<Record<string, string>>,
): TileCsvParse {
  const quoteError = parseResult.errors.find((error) =>
    QUOTE_ERROR_CODES.has(error.code),
  )
  if (quoteError) {
    return { ok: false, error: quoteError.message }
  }

  const columns = parseResult.meta.fields
  if (!columns?.length) {
    return { ok: false, error: 'This CSV has no columns.' }
  }

  return { ok: true, rows: parseResult.data, columns }
}

export function parseTileCsv(input: string): TileCsvParse {
  return interpretTileCsvParseResult(
    Papa.parse<Record<string, string>>(input, tileCsvParseConfig),
  )
}

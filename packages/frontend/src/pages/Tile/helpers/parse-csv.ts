import Papa, {
  type ParseError,
  type ParseMeta,
  type ParseResult,
} from 'papaparse'

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

export interface ValidParseResult extends ParseResult<Record<string, string>> {
  meta: ParseMeta & { fields: string[] }
}

export type TileCsvParse =
  | { ok: true; rows: Record<string, string>[]; columns: string[] }
  | { ok: false; error: string }

function hasBrokenQuotes(parseResult: ParseResult<Record<string, string>>) {
  return parseResult.errors.some((error) => QUOTE_ERROR_CODES.has(error.code))
}

export function isValidParseResult(
  parseResult: ParseResult<Record<string, string>>,
): parseResult is ValidParseResult {
  return (
    !hasBrokenQuotes(parseResult) &&
    !!parseResult.meta.fields &&
    parseResult.meta.fields.length > 0
  )
}

export function csvParseError(
  parseResult: ParseResult<Record<string, string>>,
): string {
  const quoteError = parseResult.errors.find((error) =>
    QUOTE_ERROR_CODES.has(error.code),
  )
  if (quoteError) {
    return quoteError.message
  }
  return 'This CSV has no columns.'
}

export function parseTileCsv(input: string): TileCsvParse {
  const parseResult = Papa.parse<Record<string, string>>(
    input,
    tileCsvParseConfig,
  )
  if (!isValidParseResult(parseResult)) {
    return { ok: false, error: csvParseError(parseResult) }
  }
  return {
    ok: true,
    rows: parseResult.data,
    columns: parseResult.meta.fields,
  }
}

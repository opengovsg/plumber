// Rendering a table variable costs rows × selected columns, so both are capped.
export const MAX_TABLE_VARIABLE_COLUMNS = 100
export const MAX_TABLE_VARIABLE_ROWS = 500
// Shared by every table variable in one step, since one email body can hold
// many tables. Bounds the HTML that the email sanitiser and execution log handle.
export const MAX_TABLE_VARIABLE_BYTES_PER_STEP = 10 * 1024 * 1024

const EMPTY_PARAGRAPH = /<p style="margin: 0;">\s*<\/p>/g

/**
 * Upper bound on the bytes Postman sends for table HTML. Postman turns each
 * newline into <br> (3 more bytes) and fills each empty paragraph with &nbsp;
 * (5 more bytes). Whitespace-only cells are over-counted, never under-counted.
 */
export function sentTableByteLength(html: string): number {
  let bytes = 0
  for (let i = 0; i < html.length; i++) {
    const code = html.charCodeAt(i)
    if (code < 0x80) {
      bytes += code === 0x0a ? 4 : 1
    } else if (code < 0x800) {
      bytes += 2
    } else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      (html.charCodeAt(i + 1) & 0xfc00) === 0xdc00
    ) {
      // A surrogate pair encodes one 4-byte character.
      bytes += 4
      i++
    } else {
      bytes += 3
    }
  }
  return bytes + 5 * (html.match(EMPTY_PARAGRAPH)?.length ?? 0)
}

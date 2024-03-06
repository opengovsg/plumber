// Taken from Unicode general punctuation range
const DASHES = /[\u2010-\u2015]/g
const SINGLE_QUOTES = /[\u2018\u2019]/g
const DOUBLE_QUOTES = /[\u201C\u201D]/g

export function normalizeSpecialChars(input: string): string {
  return input
    .replaceAll(DASHES, '-')
    .replaceAll(SINGLE_QUOTES, "'")
    .replaceAll(DOUBLE_QUOTES, '"')
}

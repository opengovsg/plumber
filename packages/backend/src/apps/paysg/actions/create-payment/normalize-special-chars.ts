//
// Small, best effort mapping.
//
// If this gets too unwieldy, we can consider moving to something like
// unidecode-plus. Decided not to use it for now due to weird licensing (hybrid
// MIT and Perl), and that validating _all_ its replacements is too time
// consuming.
//
const UNICODE_TO_ASCII_MAP: Record<number, string> = {
  //
  // Dashes
  //
  0x2010: `-`, // General Punctuation
  0x2011: `-`,
  0x2012: `-`,
  0x2013: `-`,
  0x2014: `-`,
  0x2015: `-`,

  //
  // Single Quotes
  //
  0x2018: `'`, // General Punctuation
  0x2019: `'`,

  //
  // Commas
  //
  0x3001: `,`, // CJK
  0xff64: `,`, // Halfwidth and fullwidth

  //
  // Dots
  //
  0x3002: `.`, // CJK
  0xff61: `.`, // Halfwidth and fullwidth
}

function replacer(inputChar: string): string {
  const codePoint = inputChar.codePointAt(0)

  // Edge case: Latin range of halfwidth and fullwidth can be converted
  // mathematically.
  if (0xff01 <= codePoint && codePoint <= 0xff5e) {
    return String.fromCodePoint(codePoint + 0x20 - 0xff00)
  }

  const replacementChar = UNICODE_TO_ASCII_MAP[codePoint]
  return replacementChar ?? inputChar
}

export function normalizeSpecialChars(input: string): string {
  // Process all non-latin characters.
  return input.replaceAll(/[^\u{0020}-\u{007F}]/gu, replacer)
}

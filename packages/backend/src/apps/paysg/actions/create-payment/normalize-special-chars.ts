//
// Small, best effort mapping.
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
  // Double Quotes
  //
  0x201c: `"`, // General Punctuation
  0x201d: `"`,
  0x3003: `"`, // CJK
  0x301d: `"`,
  0x301e: `"`,

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
  return input.replaceAll(/[^\u0020-\u007F]/g, replacer)
}

/**
 * Replaces personal data with stable placeholders so a candidate item stays
 * judgeable without holding the real value. Humans still review every item.
 */

const PATTERNS = [
  { kind: 'EMAIL', regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { kind: 'NRIC', regex: /\b[STFGM]\d{7}[A-Z]\b/g },
  { kind: 'PHONE', regex: /(?<!\d)(?:\+65[ -]?)?[3689]\d{3}[ -]?\d{4}(?!\d)/g },
]

export function createRedactor() {
  const seen = new Map()
  const counters = new Map()

  function placeholder(kind, value) {
    const key = `${kind}:${value.toLowerCase()}`
    if (!seen.has(key)) {
      const count = (counters.get(kind) ?? 0) + 1
      counters.set(kind, count)
      seen.set(key, `<${kind}_${count}>`)
    }
    return seen.get(key)
  }

  function redactString(text) {
    let output = text
    for (const { kind, regex } of PATTERNS) {
      output = output.replace(regex, (match) => placeholder(kind, match))
    }
    return output
  }

  function redact(value) {
    if (typeof value === 'string') {
      return redactString(value)
    }
    if (Array.isArray(value)) {
      return value.map(redact)
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, redact(entry)]),
      )
    }
    return value
  }

  return { redact, replacements: () => seen.size }
}

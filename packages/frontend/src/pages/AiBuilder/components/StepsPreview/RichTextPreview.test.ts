import { describe, expect, it } from 'vitest'

import { isAllowedHref } from './RichTextPreview'

const BASE = 'https://example.com'

describe('isAllowedHref', () => {
  it('allows http(s), mailto, and tel', () => {
    expect(isAllowedHref('https://example.com/x', BASE)).toBe(true)
    expect(isAllowedHref('http://example.com/x', BASE)).toBe(true)
    expect(isAllowedHref('mailto:a@b.com', BASE)).toBe(true)
    expect(isAllowedHref('tel:12345', BASE)).toBe(true)
  })

  it('allows relative and fragment hrefs (no explicit scheme)', () => {
    expect(isAllowedHref('#section', BASE)).toBe(true)
    expect(isAllowedHref('/some/path', BASE)).toBe(true)
    expect(isAllowedHref('', BASE)).toBe(true)
  })

  it('blocks a plain javascript: href', () => {
    expect(isAllowedHref('javascript:alert(1)', BASE)).toBe(false)
  })

  it('blocks an HTML-entity-decoded scheme (already decoded by the DOM parser)', () => {
    expect(isAllowedHref('javascript:alert(1)', BASE)).toBe(false)
  })

  it('blocks a scheme obfuscated with a tab/newline character', () => {
    // Browsers strip ASCII tab/newline before parsing a URL, so this reads
    // as "javascript:alert(1)" when clicked despite the embedded tab.
    expect(isAllowedHref('java\tscript:alert(1)', BASE)).toBe(false)
    expect(isAllowedHref('java\nscript:alert(1)', BASE)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'

import { escapeHtml, safeHtml } from '../html-utils'

describe('html utils', () => {
  describe('escapeHtml', () => {
    it.each([
      ['&', '&amp;'],
      ['<', '&lt;'],
      ['>', '&gt;'],
      ['"', '&quot;'],
      ["'", '&#039;'],
    ])('escapes critical chars %s', (char: string, expected: string) => {
      expect(escapeHtml(char)).toBe(expected)
    })

    it('escapes mixed content with tags and attributes', () => {
      const s = `<img src=x onerror="alert('xss')"> & more`
      const e =
        '&lt;img src=x onerror=&quot;alert(&#039;xss&#039;)&quot;&gt; &amp; more'
      expect(escapeHtml(s)).toBe(e)
    })

    it('neutralizes script tags', () => {
      const s = '<script>alert(1)</script>'
      const e = '&lt;script&gt;alert(1)&lt;/script&gt;'
      expect(escapeHtml(s)).toBe(e)
    })

    it('escapes angle brackets inside text', () => {
      const s = '1 < 2 && 3 > 2'
      const e = '1 &lt; 2 &amp;&amp; 3 &gt; 2'
      expect(escapeHtml(s)).toBe(e)
    })

    it('handles template-like sequences', () => {
      const s = '${alert(1)}<div onclick=alert(1)>'
      const e = '${alert(1)}&lt;div onclick=alert(1)&gt;'
      expect(escapeHtml(s)).toBe(e)
    })

    it('leaves safe text unchanged', () => {
      expect(escapeHtml('Hello World 123')).toBe('Hello World 123')
      expect(escapeHtml('こんにちは مرحبا Здравствуйте')).toBe(
        'こんにちは مرحبا Здравствуйте',
      )
      expect(escapeHtml('🙂🚀€₿')).toBe('🙂🚀€₿')
    })
  })
})

describe('safeHtml', () => {
  it('should escape multiple HTML values in a string', () => {
    const testVariable = '<b>Hello</b>'
    const testVariable2 = '<script>alert("XSS")</script>'

    const expected = `
      This is a test:&lt;b&gt;Hello&lt;/b&gt;.
      With a new line: &lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;
    `
    expect(safeHtml`
      This is a test:${testVariable}.
      With a new line: ${testVariable2}
    `).toBe(expected)
  })
})

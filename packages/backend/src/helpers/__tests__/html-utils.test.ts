import { describe, expect, it } from 'vitest'

import { escapeHtml, safeHtml, trustedHtml } from '../html-utils'

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

describe('trustedHtml', () => {
  it('should create a trusted HTML object', () => {
    const html = '<div>Hello World</div>'
    const trusted = trustedHtml(html)

    expect(trusted).toEqual({
      __html: html,
      __trusted: true,
    })
  })

  it('should preserve HTML tags in trusted content', () => {
    const html = '<script>alert("XSS")</script><b>Bold</b>'
    const trusted = trustedHtml(html)

    expect(trusted.__html).toBe(html)
    expect(trusted.__trusted).toBe(true)
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

  it('should not escape trusted HTML content', () => {
    const trustedContent = trustedHtml('<li>Item 1</li><li>Item 2</li>')
    const regularContent = '<script>alert("XSS")</script>'

    const result = safeHtml`
      <ul>
        ${trustedContent}
      </ul>
      <p>Regular content: ${regularContent}</p>
    `

    expect(result).toContain('<li>Item 1</li><li>Item 2</li>')
    expect(result).toContain(
      '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;',
    )
  })

  it('should handle mixed trusted and regular content', () => {
    const trustedList = trustedHtml(
      '<li>Safe item</li><li>Another safe item</li>',
    )
    const dangerousContent = '<script>alert("XSS")</script>'
    const safeText = 'Hello World'

    const result = safeHtml`
      <div>
        <h1>${safeText}</h1>
        <ul>
          ${trustedList}
        </ul>
        <p>Dangerous: ${dangerousContent}</p>
      </div>
    `

    expect(result).toContain('<h1>Hello World</h1>')
    expect(result).toContain('<li>Safe item</li><li>Another safe item</li>')
    expect(result).toContain(
      '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;',
    )
  })

  it('should handle trusted HTML with escaped content inside', () => {
    const userInput = '<script>alert("XSS")</script>'
    const escapedUserInput = escapeHtml(userInput)
    const trustedContent = trustedHtml(`<li>${escapedUserInput}</li>`)

    const result = safeHtml`
      <ul>
        ${trustedContent}
      </ul>
    `

    expect(result).toContain(
      '<li>&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;</li>',
    )
    expect(result).not.toContain('<script>')
  })

  it('should handle multiple trusted HTML objects', () => {
    const trusted1 = trustedHtml('<strong>Bold text</strong>')
    const trusted2 = trustedHtml('<em>Italic text</em>')
    const regularText = 'Normal text'

    const result = safeHtml`
      <p>${trusted1} and ${trusted2} with ${regularText}</p>
    `

    expect(result).toContain('<strong>Bold text</strong>')
    expect(result).toContain('<em>Italic text</em>')
    expect(result).toContain('Normal text')
  })

  it('should handle null and undefined values gracefully', () => {
    const trustedContent = trustedHtml('<div>Content</div>')
    const nullValue = null as null
    const undefinedValue = undefined as undefined

    const result = safeHtml`
      <div>
        ${trustedContent}
        <p>Null: ${nullValue}</p>
        <p>Undefined: ${undefinedValue}</p>
      </div>
    `

    expect(result).toContain('<div>Content</div>')
    expect(result).toContain('<p>Null: </p>')
    expect(result).toContain('<p>Undefined: </p>')
  })
})

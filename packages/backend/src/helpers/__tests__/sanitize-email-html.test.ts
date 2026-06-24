import { describe, expect, it } from 'vitest'

import { sanitizeEmailHtml } from '../sanitize-email-html'

describe('sanitizeEmailHtml', () => {
  it('keeps allowlisted formatting tags', () => {
    const html = '<p>Hello <strong>world</strong> <em>now</em></p>'
    expect(sanitizeEmailHtml(html)).toBe(html)
  })

  it('strips <script> tags, leaving the body as inert text (matches Postman)', () => {
    // stripIgnoreTag removes the <script> element but keeps its text content,
    // which is harmless once the tag is gone — identical to Postman's filter.
    const out = sanitizeEmailHtml('<p>hi</p><script>alert(1)</script>')
    expect(out).not.toContain('<script')
    expect(out).toBe('<p>hi</p>alert(1)')
  })

  it('drops event-handler attributes', () => {
    const out = sanitizeEmailHtml('<p onclick="steal()">x</p>')
    expect(out).not.toContain('onclick')
    expect(out).toContain('<p>x</p>')
  })

  it('removes javascript: hrefs but keeps the anchor', () => {
    const out = sanitizeEmailHtml('<a href="javascript:alert(1)">x</a>')
    expect(out).not.toContain('javascript:')
  })

  it('keeps http/https/mailto links', () => {
    expect(sanitizeEmailHtml('<a href="https://example.com">x</a>')).toContain(
      'href="https://example.com"',
    )
    expect(sanitizeEmailHtml('<a href="mailto:a@b.com">x</a>')).toContain(
      'href="mailto:a@b.com"',
    )
  })

  it('strips disallowed tags like iframe/form but keeps inner text', () => {
    expect(sanitizeEmailHtml('<iframe src="evil"></iframe>')).not.toContain(
      '<iframe',
    )
    const formOut = sanitizeEmailHtml('<form><input name="pw"/></form>')
    expect(formOut).not.toContain('<form')
    expect(formOut).not.toContain('<input')
  })

  it('preserves inline style on table cells (Plumber-generated formatting)', () => {
    const html =
      '<td style="background-color: #f2f2f2; font-weight: 600;"><p style="margin: 0;">A</p></td>'
    // xss normalises CSS whitespace (`: ` -> `:`) but preserves the properties.
    const out = sanitizeEmailHtml(html)
    expect(out).toContain('background-color:#f2f2f2')
    expect(out).toContain('font-weight:600')
    expect(out).toContain('margin:0')
  })

  it('strips dangerous data: URLs (data:text/html) from href and img src', () => {
    expect(
      sanitizeEmailHtml(
        '<a href="data:text/html,<script>alert(1)</script>">x</a>',
      ),
    ).not.toContain('data:text/html')
    expect(
      sanitizeEmailHtml('<img src="data:text/html;base64,PHNjcmlwdD4=" />'),
    ).not.toContain('data:text/html')
  })

  it('keeps data:image/* sources (safe inline images in email)', () => {
    expect(
      sanitizeEmailHtml('<img src="data:image/png;base64,iVBORw0KGgo=" />'),
    ).toContain('data:image/png;base64,iVBORw0KGgo=')
  })

  it('strips vbscript: URLs', () => {
    expect(
      sanitizeEmailHtml('<a href="vbscript:msgbox(1)">x</a>'),
    ).not.toContain('vbscript:')
  })

  it('preserves the table HTML that format-table-variable generates', () => {
    // Mirror of the markup/styles in helpers/format-table-variable.ts — if the
    // allowlist or CSS whitelist ever drops one of these, table emails regress.
    const cell = 'border: 1px solid black; padding: 5px 10px; min-width: 100px;'
    const html =
      `<table style="border-collapse: collapse;"><tbody>` +
      `<tr><td style="${cell} background-color: #f2f2f2; font-weight: 600;"><p style="margin: 0;">Col</p></td></tr>` +
      `<tr><td style="${cell} background-color: #ffffff;"><p style="margin: 0;">Val</p></td></tr>` +
      `</tbody></table>`
    const out = sanitizeEmailHtml(html)
    for (const tag of ['<table', '<tbody>', '<tr>', '<td', '<p']) {
      expect(out).toContain(tag)
    }
    // xss normalises `: ` -> `:` but must preserve every property.
    for (const prop of [
      'border-collapse:collapse',
      'border:1px solid black',
      'padding:5px 10px',
      'min-width:100px',
      'background-color:#f2f2f2',
      'font-weight:600',
      'margin:0',
    ]) {
      expect(out).toContain(prop)
    }
  })

  it('strips cid: image sources (Plumber has no inline attachments)', () => {
    // Unlike Postman, Plumber omits the cid: passthrough — the SES path has no
    // attachments to reference, so cid: is treated as an unsafe scheme.
    const out = sanitizeEmailHtml('<img src="cid:logo" />')
    expect(out).not.toContain('cid:logo')
  })
})

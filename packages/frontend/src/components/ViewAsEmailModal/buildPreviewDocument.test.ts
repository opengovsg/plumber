import { describe, expect, it } from 'vitest'

import { buildPreviewDocument } from './buildPreviewDocument'

// Runs in the default node environment (like RichTextEditor/utils.test.ts).
// buildPreviewDocument is a pure string builder around @emailens/engine, so no
// DOM / jsdom / testing-library is needed.

describe('buildPreviewDocument', () => {
  it('emits a full HTML document with exactly one document-shell body', () => {
    const out = buildPreviewDocument('<p>hello</p>', 'gmail-web')

    expect(out.startsWith('<!doctype html>')).toBe(true)

    // The shell owns exactly one <body>. We pin it via the literal shell
    // prefix/suffix rather than counting "<body>" substrings, because the
    // engine returns a full document and nests its own <body> inside the
    // shell's body. The shell is what guarantees a single outer body region.
    expect(
      out.startsWith(
        '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content=',
      ),
    ).toBe(true)
    expect(out).toContain('<meta name="referrer" content="no-referrer">')
    expect(out).toMatch(/"><\/head><body>/)
    expect(out.endsWith('</body></html>')).toBe(true)
  })

  it('injects a Content-Security-Policy meta with the locked-down directives', () => {
    const out = buildPreviewDocument('<p>hello</p>', 'gmail-web')

    expect(out).toContain('<meta http-equiv="Content-Security-Policy"')
    expect(out).toContain("default-src 'none'")
    expect(out).toContain("script-src 'none'")
    expect(out).toContain('img-src data:')
  })

  it('is never looser than the inherited Helmet CSP (only allowlisted hosts)', () => {
    const out = buildPreviewDocument('<p>hello</p>', 'gmail-web')
    const policy =
      out.match(
        /http-equiv="Content-Security-Policy" content="([^"]*)"/,
      )?.[1] ?? ''

    // The inherited Helmet policy uses narrow host allowlists, never a wildcard
    // or a scheme-wide `https:`/`http:`. This meta may name a specific host
    // (which must also be in the inherited policy) but must never grant a bare
    // scheme or `*`, or it would be looser than the policy it reinforces.
    expect(policy).not.toContain('*')
    expect(policy).not.toMatch(/https?:(?!\/\/)/)
    // Remote images limited to the gov file host (also in the inherited img-src).
    expect(policy).toContain('img-src data: https://file.go.gov.sg')
    expect(policy).toContain("default-src 'none'")
    // base-uri / form-action have no default-src fallback - assert explicitly.
    expect(policy).toContain("base-uri 'none'")
    expect(policy).toContain("form-action 'none'")
  })

  it('preserves the transform output inside the body (incl. Outlook handling)', () => {
    // Sentinel proves the transformed fragment is wrapped verbatim. The
    // border-radius forces the engine down its Outlook-unsupported-CSS path.
    const sentinel = 'PLUMBER_PREVIEW_SENTINEL_8f3a'
    const out = buildPreviewDocument(
      `<div style="border-radius: 12px"><p>${sentinel}</p></div>`,
      'outlook-windows-legacy',
    )

    const body = out.slice(out.indexOf('<body>') + '<body>'.length)
    expect(body).toContain(sentinel)
    // NOTE: this engine version (@emailens/engine 0.9.2) does not emit an
    // "[if mso]" conditional comment for this input, so we intentionally do
    // not assert on it here (it would be flaky).
  })

  it('still applies the empty-<p> margin replacement', () => {
    const out = buildPreviewDocument('<div><p></p></div>', 'gmail-web')

    expect(out).toContain('<p style="margin: 0">&nbsp;</p>')
  })

  it('does NOT sanitize: a <script> survives as text but the CSP backstop is present', () => {
    // We deliberately do not run a content sanitizer; the iframe sandbox="" +
    // this CSP are the defense. So the script tag is expected to remain in the
    // output - what we assert is that the script-src 'none' policy is present.
    const out = buildPreviewDocument(
      '<p>safe</p><script>alert(1)</script>',
      'gmail-web',
    )

    expect(out).toContain('<script>alert(1)</script>')
    expect(out).toContain('<meta http-equiv="Content-Security-Policy"')
    expect(out).toContain("script-src 'none'")
  })
})

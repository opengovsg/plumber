import { transformForClient } from '@emailens/engine'

// Defense-in-depth CSP injected into the preview iframe's srcDoc document,
// layered on top of the iframe's empty sandbox (see index.tsx). This is NOT a
// content sanitizer - we deliberately do not strip attacker-controllable email
// HTML.
//
// Some notes on the policy:
// - [img-src]: We don't need anything other than GoGov files due to our existing
//   CSP.
// - [style-src]: We allow 'unsafe-inline' for email styling; we shouldn't need
//   external sheets.
// - [base-uri, form-action]: these don't fall back to default-src, so they're
//   set explicitly
// - [frame-ancestors]: is omitted: it's ignored in a meta CSP and is already
//   enforced by the parent Helmet header.
const CSP =
  "default-src 'none'; script-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; img-src data: https://file.go.gov.sg; style-src 'unsafe-inline'"

export function buildPreviewDocument(html: string, clientId: string): string {
  const transformed = transformForClient(html, clientId).html.replace(
    // Replicate logic in backend - see send-transactional-email/index.ts
    /(<p\s?((style=")([a-zA-Z0-9:;.\s()\-,]*)("))?>)\s*(<\/p>)/g,
    '<p style="margin: 0">&nbsp;</p>',
  )

  // NOTE: this also adds a no-referrer meta tag.
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="referrer" content="no-referrer"></head><body>${transformed}</body></html>`
}

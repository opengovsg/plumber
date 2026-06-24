import { FilterXSS, getDefaultCSSWhiteList } from 'xss'

/**
 * HTML sanitisation for outbound email bodies.
 *
 * The SES SendEmail API sends the HTML body verbatim — unlike the Postman
 * transactional API, which runs the body through this same `xss` filter
 * server-side. To avoid weakening that guarantee when a send is routed via
 * SES, we sanitise with the same config before the SES call.
 *
 * The allowlist is taken from postmangovsg `XSS_EMAIL_OPTION` so the sanitised
 * output is consistent across the Postman and SES paths for the HTML Plumber
 * produces. It is NOT a verbatim copy — Postman's custom `safeAttrValue` is
 * deliberately omitted (see the divergence note on the option below):
 * https://github.com/opengovsg/postmangovsg/blob/master/shared/src/templating/xss-options.ts
 */

const DEFAULT_EMAIL_ATTRS = ['style']
const NO_ATTRS: string[] = []

const XSS_EMAIL_OPTION = {
  whiteList: {
    span: DEFAULT_EMAIL_ATTRS,
    b: DEFAULT_EMAIL_ATTRS,
    strong: DEFAULT_EMAIL_ATTRS,
    i: DEFAULT_EMAIL_ATTRS,
    em: DEFAULT_EMAIL_ATTRS,
    u: DEFAULT_EMAIL_ATTRS,
    ins: DEFAULT_EMAIL_ATTRS,
    br: DEFAULT_EMAIL_ATTRS,
    p: DEFAULT_EMAIL_ATTRS,
    ul: DEFAULT_EMAIL_ATTRS,
    ol: ['start', 'type', ...DEFAULT_EMAIL_ATTRS],
    li: DEFAULT_EMAIL_ATTRS,
    h1: DEFAULT_EMAIL_ATTRS,
    h2: DEFAULT_EMAIL_ATTRS,
    h3: DEFAULT_EMAIL_ATTRS,
    h4: DEFAULT_EMAIL_ATTRS,
    h5: DEFAULT_EMAIL_ATTRS,
    h6: DEFAULT_EMAIL_ATTRS,
    a: ['href', 'title', 'target', ...DEFAULT_EMAIL_ATTRS],
    img: [
      'src',
      'alt',
      'title',
      'width',
      'height',
      'data-link',
      ...DEFAULT_EMAIL_ATTRS,
    ],
    div: NO_ATTRS,
    tbody: NO_ATTRS,
    table: DEFAULT_EMAIL_ATTRS,
    tr: DEFAULT_EMAIL_ATTRS,
    td: ['colspan', 'rowspan', ...DEFAULT_EMAIL_ATTRS],
    th: DEFAULT_EMAIL_ATTRS,
    sup: DEFAULT_EMAIL_ATTRS,
    caption: DEFAULT_EMAIL_ATTRS,
    mark: NO_ATTRS,
  },
  // Divergence from Postman: Postman's config adds a custom safeAttrValue that
  // passes through `{{keyword}}` href/src values and `cid:` image sources. Both
  // are omitted here because neither can occur in Plumber — step variables are
  // resolved before send (no `{{ }}` survives to the body), and Plumber builds
  // no Content-ID/inline-attachment parts (and the SES path has no attachments
  // at all). We rely on xss's default safeAttrValue, which strips dangerous
  // URL schemes and runs the CSS filter below.
  stripIgnoreTag: true,
  css: {
    whiteList: {
      ...getDefaultCSSWhiteList(),
      'white-space': true,
    },
  },
}

// Build the filter once — constructing a FilterXSS rebuilds the tag parser, so
// reuse a singleton across calls.
const emailXssFilter = new FilterXSS(XSS_EMAIL_OPTION)

/**
 * Sanitise an outbound email HTML body, stripping any tags/attributes outside
 * the email allowlist: scripts, event handlers, and dangerous URL schemes
 * (javascript:, vbscript:, data:text/html, ...). Note that data:image/* is
 * still permitted for <img> sources, which is safe in an email context.
 */
export function sanitizeEmailHtml(html: string): string {
  return emailXssFilter.process(html)
}

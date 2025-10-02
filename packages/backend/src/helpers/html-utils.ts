// function to escape HTML in string
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// tag function for safe HTML templates
function safeHtml(
  strings: TemplateStringsArray,
  ...values: (string | { __html: string; __trusted: boolean })[]
): string {
  let result = ''

  // Interleave strings and escaped values
  for (let i = 0; i < strings.length; i++) {
    result += strings[i]

    if (i < values.length) {
      const value = values[i]
      if (value && typeof value === 'object' && value.__trusted) {
        result += value.__html
      } else if (value) {
        result += escapeHtml(String(value))
      }
    }
  }

  return result
}

function trustedHtml(html: string) {
  return { __html: html, __trusted: true }
}

export { escapeHtml, safeHtml, trustedHtml }

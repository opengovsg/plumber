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
function safeHtml(strings: TemplateStringsArray, ...values: string[]): string {
  let result = ''

  // Interleave strings and escaped values
  for (let i = 0; i < strings.length; i++) {
    result += strings[i]

    if (i < values.length) {
      result += escapeHtml(values[i])
    }
  }

  return result
}

export { escapeHtml, safeHtml }

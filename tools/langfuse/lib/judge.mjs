const PROMPT_KEYS = ['prompt', 'template', 'promptText', 'evalTemplate']

/**
 * Finds the judge prompt inside an evaluator payload. The field name differs by
 * evaluator type and Langfuse version, so fall back to the longest string that
 * carries the judge variables.
 */
export function extractPrompt(payload) {
  const strings = []
  const walk = (value, key) => {
    if (typeof value === 'string') {
      strings.push({ key, value })
      return
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => walk(entry, key))
      return
    }
    if (value && typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value)) {
        walk(child, childKey)
      }
    }
  }
  walk(payload, null)

  const named = strings.find(
    (entry) => PROMPT_KEYS.includes(entry.key) && entry.value.includes('{{'),
  )
  if (named) {
    return named.value
  }
  const withVariables = strings
    .filter((entry) =>
      /\{\{\s*(input|output|expected_output)\s*\}\}/.test(entry.value),
    )
    .sort((a, b) => b.value.length - a.value.length)
  return withVariables[0]?.value ?? null
}

/** Picks the evaluator by name. Names are not unique in Langfuse, so take the newest. */
export function pickEvaluator(evaluators, name) {
  const wanted = name.trim().toLowerCase()
  const matches = evaluators.filter(
    (evaluator) =>
      String(evaluator.name ?? '')
        .trim()
        .toLowerCase() === wanted,
  )
  matches.sort(
    (a, b) =>
      Date.parse(b.updatedAt ?? b.createdAt ?? 0) -
      Date.parse(a.updatedAt ?? a.createdAt ?? 0),
  )
  return { chosen: matches[0] ?? null, matches }
}

/**
 * Local judge drafts carry a notes header, then `---`, then the prompt.
 * Returns only the prompt so a diff against Langfuse ignores the notes.
 */
export function promptBody(fileText) {
  const marker = '\n---\n'
  const index = fileText.indexOf(marker)
  const body = index === -1 ? fileText : fileText.slice(index + marker.length)
  return body.trim() + '\n'
}

/**
 * Rebuilds the template from one rendered judge prompt. The evaluator fills
 * {{input}}, {{output}} and {{expected_output}} between "INPUT:" and the first
 * line of the rules, so everything outside that window is template text.
 */
export function templateSkeleton(
  rendered,
  tailMarker = 'MODEL OUTPUT should be JSON',
) {
  const head = rendered.indexOf('INPUT:')
  const tail = rendered.indexOf(tailMarker)
  if (head === -1 || tail === -1 || tail < head) {
    return null
  }
  return (
    rendered.slice(0, head) +
    'INPUT:\n{{input}}\n\nMODEL OUTPUT:\n{{output}}\n\nGOLD:\n{{expected_output}}\n\n' +
    rendered.slice(tail)
  )
}

/** Joins a generation input (string, message array or object) into one text. */
export function generationText(input) {
  if (typeof input === 'string') return input
  if (Array.isArray(input)) {
    return input
      .map((message) =>
        typeof message === 'string' ? message : String(message?.content ?? ''),
      )
      .join('\n')
  }
  if (input && typeof input === 'object') {
    return generationText(input.messages ?? Object.values(input))
  }
  return ''
}

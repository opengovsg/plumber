export interface ClarificationQuestion {
  question: string
  options: string[]
}

/**
 * Extracts structured clarification questions from a CLARIFICATION_DATA HTML
 * comment block embedded in the LLM response text.
 *
 * Returns null when no valid block is found (most responses).
 * @remarks Only the first CLARIFICATION_DATA block in the text is parsed.
 */
export function parseClarificationBlock(
  text: string,
): ClarificationQuestion[] | null {
  const match = text.match(/<!--\s*CLARIFICATION_DATA\s*([\s\S]*?)\s*-->/)
  if (!match) {
    return null
  }

  const lines = match[1]
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const questions: ClarificationQuestion[] = []
  let current: ClarificationQuestion | null = null

  for (const line of lines) {
    if (line.startsWith('Q:')) {
      if (current) {
        questions.push(current)
      }
      const question = line.slice(2).trim()
      if (!question) {
        current = null
        continue
      }
      current = { question, options: [] }
    } else if (line.startsWith('- ') && current) {
      const option = line.slice(2).trim()
      if (option) {
        current.options.push(option)
      }
    } else if (current) {
      if (current.options.length === 0) {
        current.question += ' ' + line
      } else {
        current.options[current.options.length - 1] += ' ' + line
      }
    }
  }

  if (current) {
    questions.push(current)
  }

  const valid = questions.filter((q) => q.question.length > 0)
  return valid.length > 0 ? valid : null
}

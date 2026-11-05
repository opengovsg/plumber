export type PipeId = string & { readonly __brand: 'PipeId' }

const PIPE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parsePipeId(value: string): PipeId | null {
  if (!PIPE_ID_PATTERN.test(value)) {
    return null
  }
  return value as PipeId
}

export type PipeSubjectPlace = 'opening' | 'later'

export function buildPipeSubjectSentence({
  displayName,
  pipeId,
  place,
}: {
  displayName: string
  pipeId: PipeId
  place: PipeSubjectPlace
}): string {
  const safeName = displayName.replaceAll('"', "'")
  const sentence = `I've selected my pipe "${safeName}" (id: ${pipeId}).`
  if (place === 'opening') {
    return `${sentence} Read this pipe and help me change it.`
  }
  return sentence
}

export function readLastPipeSubject(
  entries: readonly {
    author: 'user' | 'assistant' | 'system'
    text: string
  }[],
): { pipeId: PipeId; displayName: string } | null {
  // A shared /g regex would keep lastIndex across requests.
  const pattern = new RegExp(
    'I\'ve selected my pipe "([^"]*)" \\(id: ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\\)\\.',
    'gi',
  )
  let latest: { pipeId: PipeId; displayName: string } | null = null

  for (const entry of entries) {
    if (entry.author !== 'user') {
      continue
    }
    pattern.lastIndex = 0
    for (const match of entry.text.matchAll(pattern)) {
      const pipeId = parsePipeId(match[2] ?? '')
      if (!pipeId) {
        continue
      }
      latest = { pipeId, displayName: match[1] ?? '' }
    }
  }

  return latest
}

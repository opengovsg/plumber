export type Segment =
  | { type: 'text'; text: string }
  | { type: 'variable'; label: string }

const VARIABLE_REGEX = /\{\{step\.[^.}]+\.([^}]+)\}\}/g
const HEX_MODIFIER_SUFFIX_REGEX = /\|[a-fA-F0-9]+$/

export function parseParameterValue(value: string): Segment[] {
  const segments: Segment[] = []
  let lastIndex = 0

  VARIABLE_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = VARIABLE_REGEX.exec(value)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: value.slice(lastIndex, match.index) })
    }
    const rawPath = match[1].replace(HEX_MODIFIER_SUFFIX_REGEX, '')
    const lastSegment = rawPath.split('.').pop() ?? rawPath
    const withSpaces = lastSegment.replace(/_/g, ' ')
    const label =
      withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1).toLowerCase()
    segments.push({ type: 'variable', label })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < value.length) {
    segments.push({ type: 'text', text: value.slice(lastIndex) })
  }

  return segments
}

import { expectedOutputOf } from './schema.mjs'

function count(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

function sorted(map) {
  return Object.fromEntries([...map.entries()].sort((a, b) => b[1] - a[1]))
}

/**
 * Describes the shape of a dataset without printing item content, so the
 * summary can be shared outside the team.
 */
export function inspectItems(items) {
  const inputKeys = new Map()
  const inputTypes = new Map()
  const expectedKeys = new Map()
  const decisions = new Map()
  const suites = new Map()
  const metadataKeys = new Map()
  const coverTags = new Map()
  const tools = new Map()
  const forbidden = new Map()
  const clarifyKeys = new Map()

  for (const item of items) {
    const input = item.input
    inputTypes.set(
      Array.isArray(input) ? 'array' : typeof input,
      (inputTypes.get(Array.isArray(input) ? 'array' : typeof input) ?? 0) + 1,
    )
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      for (const key of Object.keys(input)) {
        count(inputKeys, key)
      }
    }
    const expected = expectedOutputOf(item) ?? {}
    for (const key of Object.keys(expected)) {
      count(expectedKeys, key)
    }
    count(decisions, expected.decision ?? '(none)')
    if (expected.decision === 'clarify') {
      for (const key of Object.keys(expected)) {
        count(clarifyKeys, key)
      }
    }
    if (expected.tool) {
      count(tools, expected.tool)
    }
    for (const tool of expected.must_not_tools ?? []) {
      count(forbidden, tool)
    }
    const metadata = item.metadata ?? {}
    for (const key of Object.keys(metadata)) {
      count(metadataKeys, key)
    }
    count(suites, JSON.stringify(metadata.suite ?? null))
    for (const tag of metadata.covers ?? []) {
      count(coverTags, tag)
    }
  }

  return {
    items: items.length,
    inputTypes: sorted(inputTypes),
    inputKeys: sorted(inputKeys),
    expectedOutputKeys: sorted(expectedKeys),
    clarifyKeys: sorted(clarifyKeys),
    decisions: sorted(decisions),
    expectedTools: sorted(tools),
    forbiddenTools: sorted(forbidden),
    metadataKeys: sorted(metadataKeys),
    suites: sorted(suites),
    coverTags: sorted(coverTags),
  }
}

export function formatInspection(report) {
  const section = (title, entries) => {
    const rows = Object.entries(entries)
    if (rows.length === 0) {
      return `${title}: none`
    }
    return `${title}:\n${rows
      .map(([key, value]) => `  ${key}: ${value}`)
      .join('\n')}`
  }
  return [
    `${report.items} items`,
    section('input types', report.inputTypes),
    section('input keys', report.inputKeys),
    section('expected_output keys', report.expectedOutputKeys),
    section('keys on clarify items', report.clarifyKeys),
    section('decisions', report.decisions),
    section('expected tools', report.expectedTools),
    section('must_not_tools', report.forbiddenTools),
    section('metadata keys', report.metadataKeys),
    section('suite values', report.suites),
    section('covers tags', report.coverTags),
  ].join('\n\n')
}

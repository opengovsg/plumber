import { expectedOutputOf } from './schema.mjs'

/**
 * Reads the tool a tag covers. Accepts "tool:create_pipe" and the older
 * "create_pipe:confirmation" form.
 */
export function toolOfTag(tag, tools) {
  const [head, tail] = String(tag).split(':')
  if (head === 'tool' && tail) {
    return tail
  }
  if (tools && tools.includes(head)) {
    return head
  }
  return null
}

export function appOfTag(tag) {
  const [head, tail] = String(tag).split(':')
  return head === 'app' && tail ? tail : null
}

function expectedTools(expected) {
  if (!expected) {
    return []
  }
  if (expected.decision === 'tool_call' && expected.tool) {
    return [expected.tool]
  }
  if (expected.decision === 'any_of') {
    return (expected.options ?? [])
      .map((option) => option?.tool)
      .filter(Boolean)
  }
  if (expected.decision === 'trajectory') {
    return (expected.trajectory ?? []).map((step) => step?.tool).filter(Boolean)
  }
  return []
}

function bump(map, key, field) {
  const entry = map.get(key) ?? { expected: 0, forbidden: 0, tagged: 0 }
  entry[field] += 1
  map.set(key, entry)
}

export function coverageReport(items, options = {}) {
  const tools = options.knownTools ?? null
  const byDecision = new Map()
  const bySuite = new Map()
  const byTool = new Map()
  const byApp = new Map()
  const byTag = new Map()

  for (const tool of tools ?? []) {
    byTool.set(tool, { expected: 0, forbidden: 0, tagged: 0 })
  }

  for (const item of items) {
    const expected = expectedOutputOf(item) ?? {}
    const decision = expected.decision ?? 'invalid'
    byDecision.set(decision, (byDecision.get(decision) ?? 0) + 1)
    const suite = item.metadata?.suite ?? 'regression'
    bySuite.set(suite, (bySuite.get(suite) ?? 0) + 1)

    for (const tool of expectedTools(expected)) {
      bump(byTool, tool, 'expected')
    }
    for (const tool of expected.must_not_tools ?? []) {
      bump(byTool, tool, 'forbidden')
    }
    for (const tag of item.metadata?.covers ?? []) {
      byTag.set(tag, (byTag.get(tag) ?? 0) + 1)
      const tool = toolOfTag(tag, tools)
      if (tool) {
        bump(byTool, tool, 'tagged')
      }
      const app = appOfTag(tag)
      if (app) {
        byApp.set(app, (byApp.get(app) ?? 0) + 1)
      }
    }
  }

  const decisionsSeen = new Set(byDecision.keys())
  for (const item of items) {
    const expected = expectedOutputOf(item)
    for (const option of expected?.options ?? []) {
      if (option?.decision) {
        decisionsSeen.add(option.decision)
      }
    }
  }

  const gaps = []
  for (const [tool, counts] of byTool) {
    if (counts.expected === 0) {
      gaps.push(`${tool}: no item expects this tool`)
    }
    if (counts.forbidden === 0) {
      gaps.push(`${tool}: no item forbids this tool`)
    }
  }
  if (!decisionsSeen.has('clarify') && !decisionsSeen.has('ui_block')) {
    gaps.push('no item expects a clarifying question')
  }
  if (!decisionsSeen.has('respond')) {
    gaps.push('no item expects a plain answer with no tool call')
  }

  return {
    total: items.length,
    byDecision: Object.fromEntries(byDecision),
    bySuite: Object.fromEntries(bySuite),
    byTool: Object.fromEntries(byTool),
    byApp: Object.fromEntries(byApp),
    byTag: Object.fromEntries(byTag),
    gaps,
  }
}

function table(rows, header) {
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => String(row[i]).length)),
  )
  const line = (cells) =>
    cells.map((cell, i) => String(cell).padEnd(widths[i])).join('  ')
  return [line(header), ...rows.map(line)].join('\n')
}

export function formatCoverage(report) {
  const sections = []
  sections.push(`${report.total} items`)
  sections.push(
    table(Object.entries(report.byDecision).sort(), ['decision', 'items']),
  )
  sections.push(
    table(Object.entries(report.bySuite).sort(), ['suite', 'items']),
  )
  sections.push(
    table(
      Object.entries(report.byTool)
        .sort()
        .map(([tool, c]) => [tool, c.expected, c.forbidden, c.tagged]),
      ['tool', 'expected', 'forbidden', 'tagged'],
    ),
  )
  if (Object.keys(report.byApp).length > 0) {
    sections.push(table(Object.entries(report.byApp).sort(), ['app', 'items']))
  }
  sections.push(
    report.gaps.length > 0
      ? `Gaps:\n${report.gaps.map((gap) => `- ${gap}`).join('\n')}`
      : 'No gaps.',
  )
  return sections.join('\n\n')
}

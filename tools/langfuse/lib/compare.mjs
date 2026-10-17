/**
 * Pairs two run reports item by item. A pass rate alone hides which rows moved.
 */

function keyOf(row) {
  return row.scenario ?? row.datasetItemId
}

function indexResults(report) {
  const rows = report.results ?? []
  return new Map(rows.map((row) => [keyOf(row), row]))
}

function sliceOf(row) {
  return row.covers ?? []
}

function rate(pass, total) {
  return total === 0 ? null : pass / total
}

export function compareRuns(baseline, candidate, options = {}) {
  const minSlice = options.minSlice ?? 20
  const base = indexResults(baseline)
  const cand = indexResults(candidate)

  const bothPass = []
  const bothFail = []
  const fixed = []
  const broken = []
  const unscored = []
  const onlyInBaseline = []
  const onlyInCandidate = []

  for (const [key, row] of cand) {
    const before = base.get(key)
    if (!before) {
      onlyInCandidate.push(key)
      continue
    }
    if (before.passed == null || row.passed == null) {
      unscored.push(key)
      continue
    }
    const entry = {
      scenario: key,
      baselineTraceId: before.traceId,
      candidateTraceId: row.traceId,
      comment: row.comment ?? null,
    }
    if (before.passed && row.passed) {
      bothPass.push(key)
    } else if (!before.passed && !row.passed) {
      bothFail.push(key)
    } else if (!before.passed && row.passed) {
      fixed.push(entry)
    } else {
      broken.push(entry)
    }
  }
  for (const key of base.keys()) {
    if (!cand.has(key)) {
      onlyInBaseline.push(key)
    }
  }

  const slices = new Map()
  const addSlice = (tag, side, passed) => {
    const entry = slices.get(tag) ?? {
      baseline: { pass: 0, total: 0 },
      candidate: { pass: 0, total: 0 },
    }
    entry[side].total += 1
    if (passed) {
      entry[side].pass += 1
    }
    slices.set(tag, entry)
  }
  for (const [key, row] of cand) {
    const before = base.get(key)
    if (!before || before.passed == null || row.passed == null) {
      continue
    }
    for (const tag of new Set([...sliceOf(row), ...sliceOf(before)])) {
      addSlice(tag, 'baseline', before.passed)
      addSlice(tag, 'candidate', row.passed)
    }
  }

  const sliceRows = [...slices.entries()]
    .map(([tag, entry]) => ({
      tag,
      baseline: entry.baseline,
      candidate: entry.candidate,
      delta:
        rate(entry.candidate.pass, entry.candidate.total) -
        rate(entry.baseline.pass, entry.baseline.total),
      gate: entry.candidate.total >= minSlice,
    }))
    .sort((a, b) => a.delta - b.delta)

  const paired =
    bothPass.length + bothFail.length + fixed.length + broken.length
  const discordant = fixed.length + broken.length

  let verdict = 'no_change'
  if (broken.length > 0 && broken.length >= fixed.length) {
    verdict = 'regression'
  } else if (fixed.length > 0 && broken.length === 0) {
    verdict = 'improvement'
  } else if (discordant > 0) {
    verdict = 'mixed'
  }

  return {
    baselineRun: baseline.runName,
    candidateRun: candidate.runName,
    paired,
    discordant,
    counts: {
      bothPass: bothPass.length,
      bothFail: bothFail.length,
      fixed: fixed.length,
      broken: broken.length,
      unscored: unscored.length,
      onlyInBaseline: onlyInBaseline.length,
      onlyInCandidate: onlyInCandidate.length,
    },
    baselinePassRate: rate(bothPass.length + broken.length, paired),
    candidatePassRate: rate(bothPass.length + fixed.length, paired),
    fixed,
    broken,
    bothFail,
    unscored,
    onlyInBaseline,
    onlyInCandidate,
    slices: sliceRows,
    verdict,
    minSlice,
  }
}

function pct(value) {
  return value == null ? 'n/a' : `${(value * 100).toFixed(1)}%`
}

export function formatCompare(result) {
  const lines = []
  lines.push(`baseline  ${result.baselineRun}  ${pct(result.baselinePassRate)}`)
  lines.push(
    `candidate ${result.candidateRun}  ${pct(result.candidatePassRate)}`,
  )
  lines.push(
    `paired ${result.paired}: both pass ${result.counts.bothPass}, both fail ${result.counts.bothFail}, fixed ${result.counts.fixed}, broken ${result.counts.broken}`,
  )
  if (
    result.counts.unscored ||
    result.counts.onlyInBaseline ||
    result.counts.onlyInCandidate
  ) {
    lines.push(
      `skipped: unscored ${result.counts.unscored}, only in baseline ${result.counts.onlyInBaseline}, only in candidate ${result.counts.onlyInCandidate}`,
    )
  }
  lines.push(`verdict: ${result.verdict}`)
  if (result.discordant > 0 && result.discordant < 20) {
    lines.push(
      `only ${result.discordant} rows moved. Below 20 flips this is noise unless the same rows flip again on a re-run.`,
    )
  }
  if (result.broken.length > 0) {
    lines.push('', 'Broken (pass -> fail):')
    for (const row of result.broken) {
      lines.push(
        `- ${row.scenario}  trace ${row.candidateTraceId}${
          row.comment ? `  ${row.comment}` : ''
        }`,
      )
    }
  }
  if (result.fixed.length > 0) {
    lines.push('', 'Fixed (fail -> pass):')
    for (const row of result.fixed) {
      lines.push(`- ${row.scenario}`)
    }
  }
  const moved = result.slices.filter((slice) => slice.delta !== 0)
  if (moved.length > 0) {
    lines.push('', 'Slices that moved:')
    for (const slice of moved) {
      const gate = slice.gate ? '' : `  (n<${result.minSlice}, smoke test only)`
      lines.push(
        `- ${slice.tag}: ${slice.baseline.pass}/${slice.baseline.total} -> ${slice.candidate.pass}/${slice.candidate.total}${gate}`,
      )
    }
  }
  return lines.join('\n')
}

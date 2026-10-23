/**
 * Compares judge verdicts with human labels. True positive rate and true
 * negative rate are reported separately because a lenient judge hides
 * failures while keeping accuracy high.
 */

function verdictOf(row) {
  if (row.passed === true) {
    return 'pass'
  }
  if (row.passed === false) {
    return 'fail'
  }
  return null
}

export function calibrate(reportOrReports, labels, options = {}) {
  const min = options.min ?? 0.9
  const reports = Array.isArray(reportOrReports)
    ? reportOrReports
    : [reportOrReports]
  // Labels name their run, so rows from several runs of the same judge can be
  // pooled without a scenario from run a matching a verdict from run b.
  const byRunAndScenario = new Map()
  for (const report of reports) {
    for (const row of report.results ?? []) {
      byRunAndScenario.set(
        `${report.runName ?? ''}\u0000${row.scenario ?? row.datasetItemId}`,
        row,
      )
    }
  }
  const runNames = reports.map((report) => report.runName ?? null)
  const counts = { tp: 0, tn: 0, fp: 0, fn: 0 }
  const disagreements = []
  const unmatched = []
  const unlabeled = []

  for (const label of labels) {
    if (label.run && !runNames.includes(label.run)) {
      continue
    }
    const row = label.run
      ? byRunAndScenario.get(`${label.run}\u0000${label.scenario}`)
      : runNames
          .map((name) =>
            byRunAndScenario.get(`${name ?? ''}\u0000${label.scenario}`),
          )
          .find(Boolean)
    if (!row) {
      unmatched.push(label.scenario)
      continue
    }
    const judge = verdictOf(row)
    if (!['pass', 'fail'].includes(label.human) || judge == null) {
      unlabeled.push(label.scenario)
      continue
    }
    if (label.human === 'pass' && judge === 'pass') {
      counts.tp += 1
    } else if (label.human === 'fail' && judge === 'fail') {
      counts.tn += 1
    } else {
      if (label.human === 'fail') {
        counts.fp += 1
      } else {
        counts.fn += 1
      }
      disagreements.push({
        scenario: label.scenario,
        human: label.human,
        judge,
        traceId: row.traceId,
        judgeComment: row.comment ?? null,
        note: label.note ?? null,
      })
    }
  }

  const humanPass = counts.tp + counts.fn
  const humanFail = counts.tn + counts.fp
  const tpr = humanPass === 0 ? null : counts.tp / humanPass
  const tnr = humanFail === 0 ? null : counts.tn / humanFail
  const labeled = humanPass + humanFail

  return {
    runName: runNames.length === 1 ? runNames[0] : runNames.join(' + '),
    labeled,
    humanPass,
    humanFail,
    counts,
    tpr,
    tnr,
    min,
    ok: tpr != null && tnr != null && tpr >= min && tnr >= min,
    disagreements,
    unmatched,
    unlabeled,
  }
}

/**
 * Picks rows for a human to label. Stratified by judge verdict so the
 * labelled set has enough judge fails to measure the true negative rate.
 */
export function labelTemplate(report, options = {}) {
  const perClass = options.perClass ?? 50
  const classes = options.only ? [options.only] : ['pass', 'fail']
  const rows = (report.results ?? []).filter((row) => verdictOf(row) != null)
  const pick = (verdict) =>
    rows.filter((row) => verdictOf(row) === verdict).slice(0, perClass)
  return classes.flatMap(pick).map((row) => ({
    scenario: row.scenario ?? row.datasetItemId,
    run: report.runName ?? null,
    traceId: row.traceId,
    judge: verdictOf(row),
    human: null,
    note: '',
  }))
}

/**
 * Adds template rows to an existing labels file. Rows already present (same
 * run and scenario) keep their human label, so a second run's failures can be
 * pooled without redoing finished work.
 */
export function mergeLabels(existing, added) {
  const key = (row) => `${row.run ?? ''}\u0000${row.scenario}`
  const seen = new Set(existing.map(key))
  return [...existing, ...added.filter((row) => !seen.has(key(row)))]
}

function pct(value) {
  return value == null ? 'n/a' : `${(value * 100).toFixed(1)}%`
}

export function formatCalibration(result) {
  const lines = []
  lines.push(
    `${result.labeled} labelled rows (${result.humanPass} human pass, ${result.humanFail} human fail)`,
  )
  lines.push(
    `true positive rate ${pct(
      result.tpr,
    )} (judge pass when human pass), true negative rate ${pct(
      result.tnr,
    )} (judge fail when human fail), minimum ${pct(result.min)}`,
  )
  lines.push(result.ok ? 'judge is calibrated' : 'judge is NOT calibrated')
  if (result.labeled < 60) {
    lines.push(
      'fewer than 60 labels: the rates have wide error bars. Label more rows before trusting them.',
    )
  }
  if (result.disagreements.length > 0) {
    lines.push('', 'Disagreements:')
    for (const row of result.disagreements) {
      lines.push(
        `- ${row.scenario}: human ${row.human}, judge ${row.judge}  trace ${
          row.traceId
        }${row.judgeComment ? `  ${row.judgeComment}` : ''}`,
      )
    }
  }
  if (result.unmatched.length > 0) {
    lines.push('', `Not in report: ${result.unmatched.join(', ')}`)
  }
  if (result.unlabeled.length > 0) {
    lines.push(
      '',
      `Skipped (no human or judge verdict): ${result.unlabeled.join(', ')}`,
    )
  }
  return lines.join('\n')
}

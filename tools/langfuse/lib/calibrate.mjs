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

export function calibrate(report, labels, options = {}) {
  const min = options.min ?? 0.9
  const byScenario = new Map(
    (report.results ?? []).map((row) => [
      row.scenario ?? row.datasetItemId,
      row,
    ]),
  )
  const counts = { tp: 0, tn: 0, fp: 0, fn: 0 }
  const disagreements = []
  const unmatched = []
  const unlabeled = []

  for (const label of labels) {
    if (label.run && report.runName && label.run !== report.runName) {
      continue
    }
    const row = byScenario.get(label.scenario)
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
    runName: report.runName ?? null,
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
  const rows = (report.results ?? []).filter((row) => verdictOf(row) != null)
  const pick = (verdict) =>
    rows.filter((row) => verdictOf(row) === verdict).slice(0, perClass)
  return [...pick('pass'), ...pick('fail')].map((row) => ({
    scenario: row.scenario ?? row.datasetItemId,
    run: report.runName ?? null,
    traceId: row.traceId,
    judge: verdictOf(row),
    human: null,
    note: '',
  }))
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

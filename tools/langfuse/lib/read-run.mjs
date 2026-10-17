async function listAll(fetchPage) {
  const rows = []
  let page = 1
  let totalPages = 1
  do {
    const response = await fetchPage(page)
    rows.push(...response.data)
    totalPages = response.meta?.totalPages ?? 1
    page += 1
  } while (page <= totalPages)
  return rows
}

function scoreFromTrace(trace, scoreName) {
  const matches = (trace.scores ?? []).filter(
    (score) => score.name === scoreName,
  )
  matches.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
  return matches.at(-1) ?? null
}

function scenarioOf(item) {
  const metadata = item?.metadata
  if (metadata && typeof metadata === 'object' && metadata.scenario) {
    return metadata.scenario
  }
  return null
}

function coversOf(item) {
  const covers = item?.metadata?.covers
  return Array.isArray(covers) ? covers : []
}

function modelOutput(trace, observationId) {
  const observations = trace.observations ?? []
  const linked = observationId
    ? observations.find((observation) => observation.id === observationId)
    : null
  if (linked?.output != null) {
    return linked.output
  }
  const generations = observations.filter(
    (observation) =>
      observation.type === 'GENERATION' && observation.output != null,
  )
  if (generations.length > 0) {
    return generations[generations.length - 1].output
  }
  return trace.output ?? null
}

async function mapPool(items, limit, mapper) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index], index)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  )
  return results
}

function isFalseScore(score) {
  if (score.value === 0) {
    return true
  }
  return String(score.stringValue ?? '').toLowerCase() === 'false'
}

export async function readEvalRun(client, options) {
  const { datasetName, runName, scoreName } = options
  const runs = await listAll((page) =>
    client.api.datasets.getRuns(datasetName, { page, limit: 50 }),
  )
  if (runs.length === 0) {
    throw new Error(`Dataset "${datasetName}" has no runs.`)
  }

  const run = runName
    ? runs.find((candidate) => candidate.name === runName)
    : [...runs].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      )[0]
  if (!run) {
    throw new Error(
      `Run "${runName}" was not found on dataset "${datasetName}".`,
    )
  }

  const runWithItems = await client.api.datasets.getRun(datasetName, run.name)
  const dataset = await client.dataset.get(datasetName)

  const itemsById = new Map(dataset.items.map((item) => [item.id, item]))

  const rows = await mapPool(
    runWithItems.datasetRunItems,
    5,
    async (runItem) => {
      const item = itemsById.get(runItem.datasetItemId)
      const trace = await client.api.trace.get(runItem.traceId)
      const score = scoreFromTrace(trace, scoreName)
      return {
        datasetItemId: runItem.datasetItemId,
        traceId: runItem.traceId,
        scenario: scenarioOf(item),
        covers: coversOf(item),
        input: item?.input ?? null,
        expectedOutput: item?.expectedOutput ?? null,
        metadata: item?.metadata ?? null,
        output: modelOutput(trace, runItem.observationId),
        score: score
          ? {
              name: score.name,
              value: score.value,
              stringValue: score.stringValue ?? null,
              comment: score.comment ?? null,
            }
          : null,
      }
    },
  )

  const failed = rows.filter((row) => row.score && isFalseScore(row.score))
  const passed = rows.filter((row) => row.score && !isFalseScore(row.score))
  const unscored = rows.filter((row) => !row.score)

  return {
    datasetName,
    runName: run.name,
    runId: run.id,
    scoreName,
    fetchedAt: new Date().toISOString(),
    counts: {
      total: rows.length,
      passed: passed.length,
      failed: failed.length,
      unscored: unscored.length,
    },
    results: rows.map((row) => ({
      datasetItemId: row.datasetItemId,
      scenario: row.scenario,
      covers: row.covers,
      traceId: row.traceId,
      passed: row.score ? !isFalseScore(row.score) : null,
      comment: row.score?.comment ?? null,
    })),
    failures: failed,
    unscored: unscored.map((row) => ({
      datasetItemId: row.datasetItemId,
      scenario: row.scenario,
      traceId: row.traceId,
    })),
  }
}

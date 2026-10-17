/**
 * Moves a sampled candidate into items.json as a draft. The author still
 * decides the gold. Only the fields the item format needs survive.
 */
export function adoptCandidate(candidate, { scenario, today }) {
  const metadata = candidate.metadata ?? {}
  return {
    id: scenario,
    input: candidate.input,
    expected_output: candidate.expected_output,
    metadata: {
      scenario,
      covers: metadata.covers ?? [],
      suite: metadata.suite ?? 'journey',
      stage: 'capability',
      status: 'draft',
      added: today,
      source_trace_id: metadata.source_trace_id ?? null,
      source_session_id: metadata.source_session_id ?? null,
      prompt_version: metadata.prompt_version ?? null,
      observed_decision: metadata.observed?.decision ?? null,
    },
  }
}

export function findCandidate(candidates, traceId) {
  return (
    candidates.find(
      (candidate) => candidate.metadata?.source_trace_id === traceId,
    ) ?? null
  )
}

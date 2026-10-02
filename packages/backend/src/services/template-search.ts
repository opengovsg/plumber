import type { ITemplate } from '@plumber/types'

import { z } from 'zod'

import appConfig from '@/config/app'

const JEV_MODEL_ID = 'typesafe-ai/jev'
const EVALUATION_URL = 'https://ai-gateway.vercel.sh/v4/ai/evaluation-model'
const MIN_MATCH_PROBABILITY = 0.3
const REQUEST_TIMEOUT_MS = 10_000

export class TemplateSearchNotConfiguredError extends Error {}

const evaluationResponseSchema = z.object({
  answers: z.record(
    z.string(),
    z.discriminatedUnion('type', [
      z.object({ type: z.literal('boolean'), probability: z.number() }),
      z.object({ type: z.literal('choice') }),
      z.object({ type: z.literal('score') }),
    ]),
  ),
})

export type EvaluateTemplates = (input: {
  query: string
  templates: readonly ITemplate[]
}) => Promise<Record<string, number>>

function describeTemplate(template: ITemplate): string {
  const appKeys = [
    ...new Set(
      template.steps.flatMap((step): string[] =>
        step.appKey ? [step.appKey] : [],
      ),
    ),
  ]
  return `Template "${template.name}": ${
    template.description
  }. Apps used: ${appKeys.join(', ')}.`
}

/**
 * Calls the AI Gateway endpoint that `experimental_evaluate` wraps.
 *
 * The backend pins `ai@5`, which predates `experimental_evaluate`.
 */
const evaluateWithJev: EvaluateTemplates = async ({ query, templates }) => {
  const apiKey = appConfig.aiGateway.apiKey
  if (!apiKey) {
    throw new TemplateSearchNotConfiguredError()
  }

  // Each template is a separate boolean question so a query can match several
  // templates instead of forcing a single winner.
  const questions = Object.fromEntries(
    templates.map((template) => [
      template.id,
      {
        type: 'boolean',
        instructions: `Is this search looking for this pipe template? ${describeTemplate(
          template,
        )}`,
        criteria: {
          true: 'The search describes what this template automates, or names an app it uses.',
          false: 'The search is about something this template does not do.',
        },
      },
    ]),
  )

  const response = await fetch(EVALUATION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'ai-gateway-protocol-version': '0.0.1',
      'ai-gateway-auth-method': 'api-key',
      'ai-evaluation-model-specification-version': '4',
      'ai-model-id': JEV_MODEL_ID,
    },
    body: JSON.stringify({
      state: query,
      questions,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    // IMPORTANT: omit the response body. It can echo request details.
    throw new Error(`Evaluation failed with status ${response.status}`)
  }

  const { answers } = evaluationResponseSchema.parse(await response.json())
  return Object.fromEntries(
    Object.entries(answers).map(([id, answer]) => [
      id,
      answer.type === 'boolean' ? answer.probability : 0,
    ]),
  )
}

/**
 * Returns template IDs ordered from best to worst match.
 *
 * Returns every match above the floor because the caller hides some templates.
 */
export async function searchTemplates({
  query,
  templates,
  evaluateTemplates = evaluateWithJev,
}: {
  query: string
  templates: readonly ITemplate[]
  evaluateTemplates?: EvaluateTemplates
}): Promise<string[]> {
  const trimmed = query.trim()
  if (!trimmed || templates.length === 0) {
    return []
  }

  const probabilities = await evaluateTemplates({ query: trimmed, templates })
  const knownIds = new Set(templates.map((template) => template.id))

  return Object.entries(probabilities)
    .filter(
      ([id, probability]) =>
        knownIds.has(id) && probability >= MIN_MATCH_PROBABILITY,
    )
    .sort(([, left], [, right]) => right - left)
    .map(([id]) => id)
}

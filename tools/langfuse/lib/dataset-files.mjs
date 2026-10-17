import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { SIDE_EFFECT_TOOLS } from './tools.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * A Langfuse dataset name can hold "/" for virtual folders. The same path
 * becomes nested directories here, so "ai-builder/chat-20261012" lives at
 * datasets/ai-builder/chat-20261012/.
 */
export function datasetDir(datasetName) {
  const parts = datasetName
    .split('/')
    .map((part) => part.replace(/[^a-zA-Z0-9._-]+/g, '_'))
    .filter(Boolean)
  return join(__dirname, '..', 'datasets', ...parts)
}

export function itemsPath(datasetName) {
  return join(datasetDir(datasetName), 'items.json')
}

export function changelogPath(datasetName) {
  return join(datasetDir(datasetName), 'CHANGELOG.md')
}

export function changelogTemplate(datasetName, today) {
  return `# ${datasetName}

Langfuse dataset: \`${datasetName}\`. Prompt under test: \`chat\`.

## Behaviour inventory

One line per rule the production prompt promises. Each line has at least one item.

- TODO

## Failure taxonomy

Named failure modes from error analysis. Each becomes a \`failure:<id>\` tag.

- TODO

## Changes

One line per gold change: date, scenario, reason, trace id.

- ${today}: created.
`
}

/**
 * Converts a Langfuse item into the repo shape. Metadata that the push
 * command sends stays as is, so a pull then push is a no-op.
 */
export function fromLangfuseItem(item) {
  const metadata =
    item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
  return {
    id: item.id,
    input: item.input ?? null,
    expected_output: item.expectedOutput ?? null,
    metadata: {
      scenario: metadata.scenario ?? item.id,
      covers: Array.isArray(metadata.covers) ? metadata.covers : [],
      ...metadata,
      ...(item.sourceTraceId && !metadata.source_trace_id
        ? { source_trace_id: item.sourceTraceId }
        : {}),
    },
  }
}

function stub(scenario, expected, covers, today, note) {
  return {
    id: scenario,
    input: {
      messages: [{ role: 'user', content: `TODO: ${note}` }],
    },
    expected_output: expected,
    metadata: {
      scenario,
      covers,
      suite: 'capability',
      status: 'draft',
      added: today,
      source_trace_id: null,
    },
  }
}

/**
 * Draft items an author fills in. Every tool gets a should-fire and a
 * must-not-fire stub. Side-effect tools also get a confirm-first stub.
 */
export function stubItems(tools, today) {
  const items = []
  const sideEffects = SIDE_EFFECT_TOOLS.filter((entry) => tools.includes(entry))
  for (const tool of tools) {
    const forbidden = sideEffects.filter((entry) => entry !== tool)
    items.push(
      stub(
        `${tool}_01_should_fire`,
        { decision: 'tool_call', tool, must_not_tools: forbidden },
        [`tool:${tool}`, 'decision:tool_call'],
        today,
        `a conversation where the prompt requires ${tool} next`,
      ),
    )
    items.push(
      stub(
        `${tool}_02_must_not_fire`,
        {
          decision: 'respond',
          required_response_intent: 'TODO: what the model should say instead',
          must_not_tools: [tool, ...forbidden],
        },
        [`tool:${tool}`, 'decision:respond'],
        today,
        `a conversation that tempts ${tool} but the prompt forbids it`,
      ),
    )
    if (sideEffects.includes(tool)) {
      items.push(
        stub(
          `${tool}_03_confirm_first`,
          {
            decision: 'any_of',
            options: [
              { decision: 'clarify' },
              { decision: 'ui_block', ui_block_type: 'CLARIFICATION_DATA' },
            ],
            must_not_tools: [tool],
            required_question_intent: `TODO: what consent ${tool} needs`,
          },
          [
            `tool:${tool}`,
            'decision:clarify',
            'failure:side_effect_without_consent',
          ],
          today,
          `a conversation where ${tool} is the right tool but the user has not said yes`,
        ),
      )
    }
  }
  return items
}

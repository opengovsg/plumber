import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { SIDE_EFFECT_TOOLS } from './tools.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

function nameParts(datasetName) {
  return datasetName
    .split('/')
    .map((part) => part.replace(/[^a-zA-Z0-9._-]+/g, '_'))
    .filter(Boolean)
}

/**
 * Local working copy of the items, ignored by git. Langfuse holds the dataset.
 * A "/" in the name becomes a directory: datasets/ai-builder/chat-20261012/.
 */
export function datasetDir(datasetName) {
  return join(__dirname, '..', 'datasets', ...nameParts(datasetName))
}

export function itemsPath(datasetName) {
  return join(datasetDir(datasetName), 'items.json')
}

/**
 * Local notes about a dataset: behaviour inventory, taxonomy, gold change log
 * and judge labels. Ignored by git like the items.
 */
export function notesDir(datasetName) {
  return join(__dirname, '..', 'notes', ...nameParts(datasetName))
}

export function changelogPath(datasetName) {
  return join(notesDir(datasetName), 'CHANGELOG.md')
}

export function labelsPath(datasetName) {
  return join(notesDir(datasetName), 'judge-labels.json')
}

export function changelogTemplate(datasetName, today) {
  return `# ${datasetName}

Langfuse dataset: \`${datasetName}\`. Prompt under test: \`chat\`. Items live in Langfuse. This file holds the reasoning.

## Behaviour inventory

One line per rule the production prompt promises. Each line has at least one item.

- TODO

## Failure taxonomy

Named failure modes from error analysis. Each becomes a \`failure:<id>\` tag.

- TODO

## Changes

One line per gold change: date, scenario, reason, trace id. Langfuse keeps the item history. This keeps the why.

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

function stub(scenario, expected, covers, today, note, suite) {
  return {
    id: scenario,
    input: {
      message: `TODO: ${note}`,
      message_history: [],
    },
    expected_output: expected,
    metadata: {
      scenario,
      covers,
      suite,
      stage: 'capability',
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
        'contract',
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
        'contract',
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
          'safety',
        ),
      )
    }
  }
  return items
}

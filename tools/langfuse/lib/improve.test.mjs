import assert from 'node:assert/strict'
import test from 'node:test'

import { applyProposals, proposeImprovement } from './improve.mjs'

test('widens prose clarify when the model used a clarification block', () => {
  const result = proposeImprovement({
    expectedOutput: {
      decision: 'clarify',
      must_not_tools: ['execute_step'],
      required_question_intent:
        'Confirm that sending a real Slack message is allowed.',
    },
    output: {
      decision: 'ui_block',
      tool: null,
      ui_block: {
        type: 'CLARIFICATION_DATA',
        question: 'Send this Slack message to #ops?',
        warning: false,
      },
    },
  })

  assert.equal(result.action, 'update')
  assert.equal(result.expectedOutput.decision, 'any_of')
  assert.deepEqual(result.expectedOutput.must_not_tools, ['execute_step'])
})

test('does not rewrite a row that called a forbidden tool', () => {
  const result = proposeImprovement({
    expectedOutput: {
      decision: 'clarify',
      must_not_tools: ['execute_step'],
    },
    output: {
      decision: 'tool_call',
      tool: 'execute_step',
    },
  })

  assert.equal(result.action, 'skip')
})

test('drops the webhook warning flag on a real-send confirm', () => {
  const result = proposeImprovement({
    expectedOutput: {
      decision: 'ui_block',
      ui_block_type: 'CLARIFICATION_DATA',
      required_fields: { warning: true },
      required_question_intent:
        'Confirm that sending a real Slack message to #ops is allowed.',
      must_not_tools: ['execute_step'],
    },
    output: {
      decision: 'ui_block',
      ui_block: {
        type: 'CLARIFICATION_DATA',
        question: 'Is it okay to post this to #ops?',
        warning: false,
      },
    },
    metadata: { covers: ['execute_step:confirmation'] },
  })

  assert.equal(result.action, 'update')
  assert.equal(result.expectedOutput.required_fields, undefined)
})

test('keeps the webhook warning flag', () => {
  const result = proposeImprovement({
    expectedOutput: {
      decision: 'ui_block',
      ui_block_type: 'CLARIFICATION_DATA',
      required_fields: { warning: true },
      required_question_intent:
        'Ask whether to overwrite the existing FormSG webhook.',
      must_not_tools: ['register_connection'],
    },
    output: {
      decision: 'ui_block',
      ui_block: {
        type: 'CLARIFICATION_DATA',
        question: 'Overwrite the webhook?',
        warning: false,
      },
    },
    metadata: { covers: ['register_connection:confirmation'] },
  })

  assert.equal(result.action, 'skip')
})

test('applies an update onto expected_output by scenario', () => {
  const { items, applied } = applyProposals(
    [
      {
        metadata: { scenario: 'formsg_slack_09_confirm_before_test' },
        expected_output: { decision: 'clarify' },
      },
    ],
    [
      {
        action: 'update',
        scenario: 'formsg_slack_09_confirm_before_test',
        expectedOutput: { decision: 'any_of' },
      },
    ],
  )

  assert.equal(applied, 1)
  assert.equal(items[0].expected_output.decision, 'any_of')
})

test('flags a judge miss when any_of already allows the model decision', () => {
  const result = proposeImprovement({
    expectedOutput: {
      decision: 'any_of',
      options: [
        { decision: 'clarify' },
        { decision: 'tool_call', tool: 'create_pipe' },
      ],
      must_not_tools: ['execute_step'],
    },
    output: { decision: 'clarify', tool: null },
  })

  assert.equal(result.action, 'judge_miss')
})

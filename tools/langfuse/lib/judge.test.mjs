import assert from 'node:assert/strict'
import test from 'node:test'

import {
  extractPrompt,
  generationText,
  pickEvaluator,
  promptBody,
  templateSkeleton,
} from './judge.mjs'

test('extractPrompt prefers a known key that carries variables', () => {
  const payload = {
    name: 'tool_intent_correctness',
    description: 'INPUT {{input}} is not the prompt',
    definition: { prompt: 'Judge this. INPUT: {{input}} OUTPUT: {{output}}' },
  }
  assert.equal(
    extractPrompt(payload),
    'Judge this. INPUT: {{input}} OUTPUT: {{output}}',
  )
})

test('extractPrompt falls back to the longest string with judge variables', () => {
  const payload = {
    definition: {
      text: 'Short {{output}}',
      body: 'A much longer judge text with {{input}} and {{expected_output}}',
    },
  }
  assert.equal(
    extractPrompt(payload),
    'A much longer judge text with {{input}} and {{expected_output}}',
  )
})

test('extractPrompt returns null when nothing looks like a judge prompt', () => {
  assert.equal(extractPrompt({ name: 'x', version: 3 }), null)
})

test('pickEvaluator matches by name, case-insensitive, newest first', () => {
  const evaluators = [
    {
      id: 'a',
      name: 'Tool_Intent_Correctness',
      updatedAt: '2026-10-18T00:00:00Z',
    },
    {
      id: 'b',
      name: 'tool_intent_correctness',
      updatedAt: '2026-10-20T00:00:00Z',
    },
    { id: 'c', name: 'other' },
  ]
  const { chosen, matches } = pickEvaluator(
    evaluators,
    'tool_intent_correctness',
  )
  assert.equal(chosen.id, 'b')
  assert.equal(matches.length, 2)
})

test('promptBody strips the notes header above the first --- line', () => {
  const file = '# notes\n\nModel: Haiku\n\n---\n\nYou evaluate things.\n'
  assert.equal(promptBody(file), 'You evaluate things.\n')
  assert.equal(promptBody('no header here\n'), 'no header here\n')
})

test('templateSkeleton restores the variables between INPUT and the rules', () => {
  const rendered =
    'You judge.\n\nINPUT:\n{"message":"hi"}\n\nMODEL OUTPUT:\n{"decision":"clarify"}\n\nGOLD:\n{"decision":"clarify"}\n\nMODEL OUTPUT should be JSON. Read:\n- decision\n'
  assert.equal(
    templateSkeleton(rendered),
    'You judge.\n\nINPUT:\n{{input}}\n\nMODEL OUTPUT:\n{{output}}\n\nGOLD:\n{{expected_output}}\n\nMODEL OUTPUT should be JSON. Read:\n- decision\n',
  )
  assert.equal(templateSkeleton('no markers here'), null)
})

test('generationText joins message arrays and passes strings through', () => {
  assert.equal(generationText('plain'), 'plain')
  assert.equal(
    generationText([
      { role: 'system', content: 'a' },
      { role: 'user', content: 'b' },
    ]),
    'a\nb',
  )
  assert.equal(generationText({ messages: [{ content: 'x' }] }), 'x')
})

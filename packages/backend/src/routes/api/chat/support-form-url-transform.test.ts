import type { TextStreamPart, ToolSet } from 'ai'
import { describe, expect, it } from 'vitest'

import { replaceSupportFormUrlPlaceholder } from './support-form-url-transform'

const URL = 'https://form.gov.sg/abc?field=chat-1'

async function run(
  chunks: TextStreamPart<ToolSet>[],
): Promise<TextStreamPart<ToolSet>[]> {
  const transform = replaceSupportFormUrlPlaceholder(URL)({
    tools: {},
    stopStream: () => undefined,
  })
  const output: TextStreamPart<ToolSet>[] = []
  const reader = new ReadableStream<TextStreamPart<ToolSet>>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk))
      controller.close()
    },
  })
    .pipeThrough(transform)
    .getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      return output
    }
    output.push(value)
  }
}

function deltas(...texts: string[]): TextStreamPart<ToolSet>[] {
  return texts.map((text) => ({ type: 'text-delta', id: 't1', text }))
}

function joinedText(parts: TextStreamPart<ToolSet>[]): string {
  return parts
    .map((part) => (part.type === 'text-delta' ? part.text : ''))
    .join('')
}

describe('replaceSupportFormUrlPlaceholder', () => {
  it('replaces a placeholder inside one delta', async () => {
    const output = await run([
      ...deltas('Use [the form]({{SUPPORT_FORM_URL}}).'),
      { type: 'text-end', id: 't1' },
    ])

    expect(joinedText(output)).toBe(`Use [the form](${URL}).`)
  })

  it('replaces a placeholder split across deltas', async () => {
    const output = await run([
      ...deltas('Use {{SUPP', 'ORT_FORM', '_URL}} now'),
      { type: 'text-end', id: 't1' },
    ])

    expect(joinedText(output)).toBe(`Use ${URL} now`)
  })

  it('releases held text that turns out not to be a placeholder', async () => {
    const output = await run([
      ...deltas('a {{', 'b}}'),
      { type: 'text-end', id: 't1' },
    ])

    expect(joinedText(output)).toBe('a {{b}}')
  })

  it('flushes held text before text-end so ordering is kept', async () => {
    const output = await run([
      ...deltas('ends with {'),
      { type: 'text-end', id: 't1' },
    ])

    expect(output.map((part) => part.type)).toEqual([
      'text-delta',
      'text-delta',
      'text-end',
    ])
    expect(joinedText(output)).toBe('ends with {')
  })

  it('passes other chunks through unchanged', async () => {
    const chunk: TextStreamPart<ToolSet> = {
      type: 'tool-input-start',
      id: 'call-1',
      toolName: 'create_pipe',
    }

    expect(await run([chunk])).toEqual([chunk])
  })
})

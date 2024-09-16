import escapeHTML from 'escape-html'
import { describe, expect, it } from 'vitest'

import { substituteOldTemplates } from './utils'

const varInfo = new Map<
  string,
  {
    label: string
    testRunValue: string
  }
>(
  Object.entries({
    '{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}': {
      label: 'hello',
      testRunValue: 'world',
    },
    '{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.papa}}': {
      label: 'papa',
      testRunValue: 'mama',
    },
    '{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.escaped}}': {
      label: 'Escaped value',
      testRunValue: "\"/>'hi'<p>Injected HTML</p>",
    },
  }),
)

describe('replaceOldTemplates', () => {
  it('should replace old {{.}} with correct <span /> value', () => {
    const testCases = [
      {
        input: '{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}',
        expected:
          '<span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello" data-label="hello" data-value="world">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}</span>',
      },
      {
        input:
          'Aloha. {{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}} world!',
        expected:
          'Aloha. <span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello" data-label="hello" data-value="world">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}</span> world!',
      },
      {
        input:
          '{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}} world! {{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.papa}}',
        expected:
          '<span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello" data-label="hello" data-value="world">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}</span> world! <span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.papa" data-label="papa" data-value="mama">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.papa}}</span>',
      },
    ]
    for (const t of testCases) {
      expect(substituteOldTemplates(t.input, varInfo)).toEqual(t.expected)
    }
  })

  it('should not replace {{.}} that is already inside a variable span', () => {
    const testCases = [
      {
        input:
          '<span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello" data-label="hello" data-value="world">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}</span>',
        expected:
          '<span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello" data-label="hello" data-value="world">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}</span>',
      },
      {
        input:
          'Aloha. <span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello" data-label="hello" data-value="world">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}</span> world!',
        expected:
          'Aloha. <span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello" data-label="hello" data-value="world">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}</span> world!',
      },
    ]
    for (const t of testCases) {
      expect(substituteOldTemplates(t.input, varInfo)).toEqual(t.expected)
    }
  })

  it('should handle undefined values', () => {
    const testInputs = [undefined, null] as unknown as string[] // this is to force the value in
    for (const input of testInputs) {
      expect(substituteOldTemplates(input, varInfo)).toEqual('')
    }
  })

  it('should be not parse {{.}} inside element attributes', () => {
    const testCases = [
      {
        input:
          '<a href="https://form.gov.sg/abc?prefilled_value={{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}">Click here</a>',
        expected:
          '<a href="https://form.gov.sg/abc?prefilled_value={{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}">Click here</a>',
      },
      {
        input:
          '<img src="https://myownhosting.website/{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}" >',
        expected:
          '<img src="https://myownhosting.website/{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}" >',
      },
    ]
    for (const t of testCases) {
      expect(substituteOldTemplates(t.input, varInfo)).toEqual(t.expected)
    }
  })

  it.each([
    // outdated data-label and data-value
    {
      input:
        '<span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello" data-label="old-label" data-value="old-world">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}</span>',
      expected:
        '<span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello" data-label="hello" data-value="world">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}</span>',
    },
    // missing data-label and data-value
    {
      input:
        '<span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}</span>',
      expected:
        '<span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello" data-label="hello" data-value="world">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}</span>',
    },
  ])(
    'should replace data-value and data-label with updated values',
    ({ input, expected }) => {
      expect(substituteOldTemplates(input, varInfo)).toEqual(expected)
    },
  )

  it.each([
    {
      input: '{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.escaped}} world!',
      expected:
        '<span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.escaped" data-label="Escaped value" data-value="&quot;/>\'hi\'<p>Injected HTML</p>">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.escaped}}</span> world!',
    },
  ])(
    'should handle escaped invalid attribute values char (i.e. double quotes)',
    ({ input, expected }) => {
      expect(substituteOldTemplates(input, varInfo)).toEqual(expected)
    },
  )

  it('should render label as the last component of the regex is label is not found or var is not found', () => {
    const input = '{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.unknown}}'
    const expected =
      '<span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.unknown" data-label="unknown" data-value>{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.unknown}}</span>'
    expect(substituteOldTemplates(input, varInfo)).toEqual(expected)
  })

  it('should preserve escaped HTML character', () => {
    const input = escapeHTML(
      '<script>alert("hi")</script> {{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}',
    )
    const expected =
      escapeHTML('<script>alert("hi")</script>') +
      ' <span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello" data-label="hello" data-value="world">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}</span>'

    expect(substituteOldTemplates(input, varInfo)).toEqual(expected)
  })

  it('should maintain line breaks and white spaces', () => {
    const input =
      'Hello      world \n        {{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}'
    const expected =
      'Hello      world \n        <span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello" data-label="hello" data-value="world">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}</span>'
    expect(substituteOldTemplates(input, varInfo)).toEqual(expected)
  })

  it('should handle this kitchen sink test case', () => {
    const input =
      'Hello {{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}} world! {{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.papa}}<br/><span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello" data-label="old-label" data-value="old-world">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}</span> <span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.papa" data-label="old-label" data-value="old-papa">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.papa}}</span>'
    const expected =
      'Hello <span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello" data-label="hello" data-value="world">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}</span> world! <span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.papa" data-label="papa" data-value="mama">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.papa}}</span><br><span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello" data-label="hello" data-value="world">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}</span> <span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.papa" data-label="papa" data-value="mama">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.papa}}</span>'
    expect(substituteOldTemplates(input, varInfo)).toEqual(expected)
  })
})

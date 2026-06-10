import escapeHTML from 'escape-html'
import { describe, expect, it } from 'vitest'

import { hexEncode } from '@/helpers/hex-encoding'
import type { StepWithVariables, TableVariable } from '@/helpers/variables'

import {
  genVariableInfoMap,
  removeProblematicWhitespace,
  substituteForPreview,
  substituteOldTemplates,
  type VariableInfoMap,
} from './utils'

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

describe('substituteForPreview', () => {
  it('replaces a variable span with its resolved value from varInfo', () => {
    const input =
      'Hi <span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello" data-label="hello" data-value="world">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}</span>!'
    expect(substituteForPreview(input, varInfo)).toEqual('Hi world!')
  })

  it('replaces a table-variable span with its resolved value', () => {
    const input =
      '<div data-type="tableVariable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello|abcd" data-label="hello" data-value="world">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello|abcd}}</div>'
    expect(substituteForPreview(input, varInfo)).toEqual('world')
  })

  // These assert the table markup byte-for-byte on purpose: the preview renderer
  // mirrors the backend's email table renderer (formatAsHtml in
  // packages/backend/src/helpers/format-table-variable.ts). If the backend markup
  // changes, update buildTableHtml and these expectations so the preview keeps
  // matching the sent email.
  describe('table variables (real editor HTML, no data-value)', () => {
    const TABLE_BASE_PATH = 'step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.data'
    const tableVarInfo: VariableInfoMap = new Map([
      [
        `{{${TABLE_BASE_PATH}}}`,
        {
          label: 'My table',
          testRunValue: '2 rows',
          table: {
            columns: [
              { id: 'c1', name: 'Name' },
              { id: 'c2', name: 'Email' },
            ],
            rows: [
              { c1: 'Alice', c2: 'alice@example.sg' },
              { c1: 'Bob', c2: 'bob@example.sg' },
            ],
          },
        },
      ],
    ])

    // Rebuild the expected markup independently of buildTableHtml (don't import
    // its constants) so these stay a byte-for-byte pin on the renderer's output.
    const cell = 'border: 1px solid black; padding: 5px 10px; min-width: 100px;'
    const headerCell = (name: string) =>
      `<td style="${cell} background-color: #F3F4F6; font-weight: 600;"><p style="margin: 0;">${name}</p></td>`
    const dataCell = (value: string, bg: string) =>
      `<td style="${cell} background-color: ${bg};"><p style="margin: 0;">${value}</p></td>`

    const makeInput = (modifier: string) => {
      const hex = hexEncode(modifier)
      const id = `${TABLE_BASE_PATH}|${hex}`
      return `<div data-type="tableVariable" data-id="${id}">{{${id}}}</div>`
    }

    it('renders the table variable as an HTML table from varInfo table data', () => {
      const expected =
        '<table style="border-collapse: collapse;"><tbody>' +
        `<tr>${headerCell('Name')}${headerCell('Email')}</tr>` +
        `<tr>${dataCell('Alice', '#FFFFFF')}${dataCell(
          'alice@example.sg',
          '#FFFFFF',
        )}</tr>` +
        `<tr>${dataCell('Bob', '#F9FAFB')}${dataCell(
          'bob@example.sg',
          '#F9FAFB',
        )}</tr>` +
        '</tbody></table>'
      expect(
        substituteForPreview(makeInput('table:c1,c2'), tableVarInfo),
      ).toEqual(expected)
    })

    it('renders only the columns selected in the hex modifier', () => {
      const expected =
        '<table style="border-collapse: collapse;"><tbody>' +
        `<tr>${headerCell('Email')}</tr>` +
        `<tr>${dataCell('alice@example.sg', '#FFFFFF')}</tr>` +
        `<tr>${dataCell('bob@example.sg', '#F9FAFB')}</tr>` +
        '</tbody></table>'
      expect(substituteForPreview(makeInput('table:c2'), tableVarInfo)).toEqual(
        expected,
      )
    })

    it('escapes HTML in cell values to prevent injection', () => {
      const injectInfo: VariableInfoMap = new Map([
        [
          `{{${TABLE_BASE_PATH}}}`,
          {
            label: 'My table',
            testRunValue: '1 row',
            table: {
              columns: [{ id: 'c1', name: 'Name' }],
              rows: [{ c1: '<script>alert(1)</script>' }],
            },
          },
        ],
      ])
      const out = substituteForPreview(makeInput('table:c1'), injectInfo)
      expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
      expect(out).not.toContain('<script>')
    })

    it('falls back to text value when the table cannot be rendered', () => {
      // varInfo entry has no table data → cannot render a table
      const noTableInfo: VariableInfoMap = new Map([
        [
          `{{${TABLE_BASE_PATH}}}`,
          { label: 'My table', testRunValue: '2 rows' },
        ],
      ])
      expect(substituteForPreview(makeInput('table:c1'), noTableInfo)).toEqual(
        '2 rows',
      )
    })
  })

  it('substitutes legacy {{step.…}} patterns in plain text nodes', () => {
    const input =
      '<p>Aloha {{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.hello}}, meet {{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.papa}}.</p>'
    expect(substituteForPreview(input, varInfo)).toEqual(
      '<p>Aloha world, meet mama.</p>',
    )
  })

  it('falls back to data-value when var is missing from varInfo', () => {
    const input =
      '<span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.missing" data-label="missing" data-value="stale-fallback">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.missing}}</span>'
    expect(substituteForPreview(input, varInfo)).toEqual('stale-fallback')
  })

  it('falls back to empty string when both varInfo and data-value are missing', () => {
    const input =
      '<span data-type="variable" data-id="step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.missing">{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.missing}}</span>'
    expect(substituteForPreview(input, varInfo)).toEqual('')
  })

  it('returns empty string for nullish input', () => {
    const inputs = [undefined, null] as unknown as string[]
    for (const input of inputs) {
      expect(substituteForPreview(input, varInfo)).toEqual('')
    }
  })
})

describe('genVariableInfoMap', () => {
  it('carries all table rows (not the truncated pill sampleRows) for the preview', () => {
    const allRows = [
      { data: { c1: 'r1' } },
      { data: { c1: 'r2' } },
      { data: { c1: 'r3' } },
      { data: { c1: 'r4' } },
      { data: { c1: 'r5' } },
    ]
    const tableVar: TableVariable = {
      name: 'step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.data',
      type: 'table',
      label: 'My table',
      displayedValue: '5 rows',
      // value is the full table data, exactly as the editor stores it
      value: JSON.stringify({
        columns: [{ id: 'c1', name: 'Name' }],
        rows: allRows,
      }),
      columns: [{ id: 'c1', name: 'Name' }],
      // sampleRows is intentionally truncated for the in-editor pill
      sampleRows: allRows.slice(0, 3).map((r) => r.data),
      totalRowCount: allRows.length,
    }
    const steps: StepWithVariables[] = [
      {
        id: 'ff5000f5-021c-4488-b6c2-c582c42ba3cf',
        name: '1. Step',
        output: [tableVar],
      },
    ]

    const map = genVariableInfoMap(steps)
    const entry = map.get('{{step.ff5000f5-021c-4488-b6c2-c582c42ba3cf.data}}')

    expect(entry?.table?.rows).toEqual([
      { c1: 'r1' },
      { c1: 'r2' },
      { c1: 'r3' },
      { c1: 'r4' },
      { c1: 'r5' },
    ])
  })
})

describe('removeProblematicWhitespace', () => {
  it('should remove non-breaking space', () => {
    const input = 'Lorem​Ipsum​Dolor​Sit​Amet​Co'
    const expected = 'LoremIpsumDolorSitAmetCo'
    expect(removeProblematicWhitespace(input)).toEqual(expected)
  })

  it('should handle other problematic whitespace', () => {
    const input = 'Hello\u200B\uFEFF\u200C\u200D\u200EWorld'
    const expected = 'HelloWorld'
    expect(removeProblematicWhitespace(input)).toEqual(expected)
  })

  it('should convert non-breaking space to regular space', () => {
    const input = ' Hello World  '
    const expected = ' Hello World  '
    expect(removeProblematicWhitespace(input)).toEqual(expected)
  })

  it('should handle empty string', () => {
    expect(removeProblematicWhitespace('')).toEqual('')
  })

  it('should handle text with no problematic characters', () => {
    const input = 'Hello World'
    expect(removeProblematicWhitespace(input)).toEqual(input)
  })

  it('should handle text with control characters', () => {
    const input = 'Hello\x00World'
    const expected = 'HelloWorld'
    expect(removeProblematicWhitespace(input)).toEqual(expected)
  })
})

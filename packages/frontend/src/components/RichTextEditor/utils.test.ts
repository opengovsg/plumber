import {
  MAX_TABLE_VARIABLE_COLUMNS,
  MAX_TABLE_VARIABLE_ROWS,
} from '@plumber/shared'
import escapeHTML from 'escape-html'
import { describe, expect, it } from 'vitest'

import { hexEncode } from '@/helpers/hex-encoding'
import type { StepWithVariables, TableVariable } from '@/helpers/variables'

import {
  genVariableInfoMap,
  removeProblematicWhitespace,
  simpleSubstitute,
  substituteForPreview,
  substituteOldTemplates,
  type VariableInfoMap,
} from './utils'

const OVER_LIMIT_NOTICE =
  "This table is over the size limit, so this email won't send."

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

    it('renders a duplicated column id once', () => {
      const out = substituteForPreview(
        makeInput('table:c1,c1,c1'),
        tableVarInfo,
      )
      expect(out.match(/Alice/g)).toHaveLength(1)
    })

    it('shows an over-limit notice past the column limit', () => {
      const columns = Array.from(
        { length: MAX_TABLE_VARIABLE_COLUMNS + 1 },
        (_, i) => ({ id: `c${i}`, name: `Col ${i}` }),
      )
      const wideInfo: VariableInfoMap = new Map([
        [
          `{{${TABLE_BASE_PATH}}}`,
          {
            label: 'My table',
            testRunValue: '1 row',
            table: { columns, rows: [{}] },
          },
        ],
      ])
      const modifier = `table:${columns.map((c) => c.id).join(',')}`
      expect(substituteForPreview(makeInput(modifier), wideInfo)).toEqual(
        OVER_LIMIT_NOTICE,
      )
    })

    describe('step byte budget', () => {
      // Each table renders about 3.8 MB of HTML, so two fit in 10 MB.
      const columns = Array.from(
        { length: MAX_TABLE_VARIABLE_COLUMNS },
        (_, i) => ({ id: `c${i}`, name: `Col ${i}` }),
      )
      const bigInfo: VariableInfoMap = new Map([
        [
          `{{${TABLE_BASE_PATH}}}`,
          {
            label: 'My table',
            testRunValue: 'big table',
            table: { columns, rows: Array.from({ length: 300 }, () => ({})) },
          },
        ],
      ])
      const modifier = `table:${columns.map((c) => c.id).join(',')}`

      it('shows an over-limit notice once the budget runs out', () => {
        const out = substituteForPreview(makeInput(modifier).repeat(3), bigInfo)
        expect(out.match(/<table/g)).toHaveLength(2)
        expect(out.endsWith(OVER_LIMIT_NOTICE)).toBe(true)
      })

      it('shows the notice for one cell over the byte budget', () => {
        const hugeInfo: VariableInfoMap = new Map([
          [
            `{{${TABLE_BASE_PATH}}}`,
            {
              label: 'My table',
              testRunValue: '1 row',
              table: {
                columns: [{ id: 'c1', name: 'Name' }],
                rows: [{ c1: '\u00e9'.repeat(6 * 1024 * 1024) }],
              },
            },
          ],
        ])
        // 6M two-byte characters are 12 MB in UTF-8, over the 10 MB budget.
        expect(substituteForPreview(makeInput('table:c1'), hugeInfo)).toEqual(
          OVER_LIMIT_NOTICE,
        )
      })

      describe('byte counting', () => {
        const token = `{{${TABLE_BASE_PATH}|${hexEncode('table:c1')}}}`
        const infoFor = (rows: Array<Record<string, unknown>>) =>
          new Map([
            [
              `{{${TABLE_BASE_PATH}}}`,
              {
                label: 'My table',
                testRunValue: 'rows',
                table: { columns: [{ id: 'c1', name: 'Name' }], rows },
              },
            ],
          ]) as VariableInfoMap
        // A newline, an apostrophe, a surrogate pair, both lone surrogates and
        // an empty cell.
        const tricky = infoFor([
          { c1: "a\nO'b\u{1F600}\ud800c\udc00" },
          { c1: '' },
        ])
        const html = simpleSubstitute(token, tricky)
        // Mirrors the body rewrites in the backend's sendEmail.
        const sentBytes = new TextEncoder().encode(
          html
            .replace(/\n/g, '<br>')
            .replace(
              /(<p\s?((style=")([a-zA-Z0-9:;.\s()\-,]*)("))?>)\s*(<\/p>)/g,
              '<p style="margin: 0">&nbsp;</p>',
            ),
        ).length

        it('escapes apostrophes the way the sent email does', () => {
          expect(html).toContain('O&#039;b')
        })

        it('renders a table that exactly fits the budget', () => {
          expect(simpleSubstitute(token, tricky, { bytes: sentBytes })).toBe(
            html,
          )
        })

        it('rejects a table one byte over the budget', () => {
          expect(
            simpleSubstitute(token, tricky, { bytes: sentBytes - 1 }),
          ).toBe(OVER_LIMIT_NOTICE)
        })

        it('stops reading cells once the budget runs out', () => {
          let laterCellRead = false
          const laterRow = Object.defineProperty({}, 'c1', {
            enumerable: true,
            get: () => {
              laterCellRead = true
              return 'x'
            },
          })
          const info = infoFor([{ c1: 'x'.repeat(2000) }, laterRow])
          expect(simpleSubstitute(token, info, { bytes: 1000 })).toBe(
            OVER_LIMIT_NOTICE,
          )
          expect(laterCellRead).toBe(false)
        })
      })

      it('shares the budget between table pills and legacy tokens', () => {
        const legacy = `<p>{{${TABLE_BASE_PATH}|${hexEncode(modifier)}}}</p>`
        const out = substituteForPreview(
          makeInput(modifier) + legacy + makeInput(modifier),
          bigInfo,
        )
        expect(out.match(/<table/g)).toHaveLength(2)
      })

      it('renders nothing for a selection with a missing column', () => {
        const out = substituteForPreview(
          makeInput(
            `table:missing,${columns
              .map((c) => c.id)
              .slice(1)
              .join(',')}`,
          ) + makeInput(modifier).repeat(2),
          bigInfo,
        )
        expect(out).not.toContain('big table')
        expect(out.match(/<table/g)).toHaveLength(2)
      })
    })

    it('shows an over-limit notice past the row limit', () => {
      const longInfo: VariableInfoMap = new Map([
        [
          `{{${TABLE_BASE_PATH}}}`,
          {
            label: 'My table',
            testRunValue: 'many rows',
            table: {
              columns: [{ id: 'c1', name: 'Name' }],
              rows: Array.from({ length: MAX_TABLE_VARIABLE_ROWS + 1 }, () => ({
                c1: 'x',
              })),
            },
          },
        ],
      ])
      expect(substituteForPreview(makeInput('table:c1'), longInfo)).toEqual(
        OVER_LIMIT_NOTICE,
      )
    })

    // simpleSubstitute powers the "has anything changed since the last test?"
    // check (matchParamsToDataIn). For the comparison to match the backend's
    // computed dataIn.body, it must swap only the {{token}} for the rendered
    // table HTML and leave the surrounding wrapper untouched — exactly what the
    // backend's computeParameters does.
    it('simpleSubstitute renders a table token to HTML, keeping the surrounding wrapper', () => {
      const expectedTable =
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
      const hex = hexEncode('table:c1,c2')
      const id = `${TABLE_BASE_PATH}|${hex}`
      const input = `<div data-type="tableVariable" data-id="${id}">{{${id}}}</div>`
      expect(simpleSubstitute(input, tableVarInfo)).toEqual(
        `<div data-type="tableVariable" data-id="${id}">${expectedTable}</div>`,
      )
    })

    it('simpleSubstitute leaves a table token as empty when there is no table data', () => {
      const noTableInfo: VariableInfoMap = new Map([
        [
          `{{${TABLE_BASE_PATH}}}`,
          { label: 'My table', testRunValue: '2 rows' },
        ],
      ])
      const hex = hexEncode('table:c1')
      const id = `${TABLE_BASE_PATH}|${hex}`
      const input = `{{${id}}}`
      expect(simpleSubstitute(input, noTableInfo)).toEqual('')
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

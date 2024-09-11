import { describe, expect, it } from 'vitest'

import { sanitiseFormulaInput } from '../../common/sanitise-input'

describe('sanitise input for excel variables', () => {
  describe('no excel formula in input', () => {
    it('no excel formula in input', () => {
      expect(sanitiseFormulaInput('variable1')).toEqual('variable1')
    })

    it('allowed formula in input', () => {
      expect(sanitiseFormulaInput('=SUM(1,2)')).toEqual('=SUM(1,2)')
    })
  })

  describe('one excel formula in input', () => {
    it('case sensitive check in input', () => {
      expect(sanitiseFormulaInput('hyperlink test')).toEqual(`'hyperlink test`)
    })

    it('start of input', () => {
      expect(
        sanitiseFormulaInput('=HYPERLINK("https://google.com", "test link")'),
      ).toEqual(`='HYPERLINK("https://google.com", "test link")`)
    })

    it('not start of input', () => {
      expect(
        sanitiseFormulaInput(
          'hello world=HYPERLINK("https://google.com", "test link")',
        ),
      ).toEqual(`hello world='HYPERLINK("https://google.com", "test link")`)
    })
  })

  describe('multiple excel formulas in input', () => {
    it('non-nested input', () => {
      expect(
        sanitiseFormulaInput(
          '=OFFSET(VLOOKUP("Banana", A1:B6, 2, FALSE), 2, 0)',
        ),
      ).toEqual(`='OFFSET('VLOOKUP("Banana", A1:B6, 2, FALSE), 2, 0)`)
    })

    it('nested input', () => {
      expect(
        sanitiseFormulaInput(`=IF(A1="Active", HYPERLINK("http://example.com/details", "Click here"), 
    IF(A1="Pending", HYPERLINK("http://example.com/pending", "Pending details"), "Inactive"))
`),
      )
        .toEqual(`=IF(A1="Active", 'HYPERLINK("http://example.com/details", "Click here"), 
    IF(A1="Pending", 'HYPERLINK("http://example.com/pending", "Pending details"), "Inactive"))
`)
    })
  })
})

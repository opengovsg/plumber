import { describe, expect, it } from 'vitest'

import {
  processInputValue,
  sanitiseFormulaInput,
} from '../../common/normalise-formula-input'

describe('normalise input for excel variables', () => {
  describe('no change to input', () => {
    it('no excel formula in input', () => {
      const input = 'variable1'
      expect(sanitiseFormulaInput(input)).toEqual(input)
      expect(processInputValue(input)).toEqual(input)
    })

    it('allowed formula in input', () => {
      const input = '=SUM(1,2)'
      expect(sanitiseFormulaInput(input)).toEqual(input)
      expect(processInputValue(input)).toEqual(input)
    })
  })

  describe('one excel formula in input', () => {
    it('case sensitive check in input', () => {
      const input = `=offset(A1, 1, 1)`
      const sanitisedInput = `='offset(A1, 1, 1)`
      expect(sanitiseFormulaInput(input)).toEqual(sanitisedInput)
      const output = `'=offset(A1, 1, 1)`
      expect(processInputValue(sanitisedInput)).toEqual(output)
    })

    it('start of input', () => {
      const input = `=HYPERLINK("https://google.com", "test link")`
      const sanitisedInput = `='HYPERLINK("https://google.com", "test link")`
      expect(sanitiseFormulaInput(input)).toEqual(sanitisedInput)
      const output = `'=HYPERLINK("https://google.com", "test link")`
      expect(processInputValue(sanitisedInput)).toEqual(output)
    })

    it('not start of input', () => {
      const input = `hello world=HYPERLINK("https://google.com", "test link")`
      const sanitisedInput = `hello world='HYPERLINK("https://google.com", "test link")`
      expect(sanitiseFormulaInput(input)).toEqual(sanitisedInput)
      const output = `'hello world=HYPERLINK("https://google.com", "test link")`
      expect(processInputValue(sanitisedInput)).toEqual(output)
    })
  })

  describe('multiple excel formulas in input', () => {
    it('non-nested input', () => {
      const input = `=OFFSET(VLOOKUP("Banana", A1:B6, 2, FALSE), 2, 0)`
      const sanitisedInput = `='OFFSET('VLOOKUP("Banana", A1:B6, 2, FALSE), 2, 0)`
      expect(sanitiseFormulaInput(input)).toEqual(sanitisedInput)
      const output = `'=OFFSET(VLOOKUP("Banana", A1:B6, 2, FALSE), 2, 0)`
      expect(processInputValue(sanitisedInput)).toEqual(output)
    })

    it('nested input', () => {
      const input = `=IF(A1="Active", HYPERLINK("http://example.com/details", "Click here"), 
    IF(A1="Pending", HYPERLINK("http://example.com/pending", "Pending details"), "Inactive"))`
      const sanitisedInput = `=IF(A1="Active", 'HYPERLINK("http://example.com/details", "Click here"), 
    IF(A1="Pending", 'HYPERLINK("http://example.com/pending", "Pending details"), "Inactive"))`
      expect(sanitiseFormulaInput(input)).toEqual(sanitisedInput)
      const output = `'=IF(A1="Active", HYPERLINK("http://example.com/details", "Click here"), 
    IF(A1="Pending", HYPERLINK("http://example.com/pending", "Pending details"), "Inactive"))`
      expect(processInputValue(sanitisedInput)).toEqual(output)
    })
  })
})

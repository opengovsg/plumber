import { describe, expect, it } from 'vitest'

import { sanitiseInputValue } from '../../common/sanitise-formula-input'

describe('sanitise excel input', () => {
  describe('no change to input', () => {
    it('empty text input', () => {
      const emptyInput = ''
      expect(sanitiseInputValue(emptyInput)).toEqual(emptyInput)
    })

    it('normal text input', () => {
      const input = 'variable1'
      expect(sanitiseInputValue(input)).toEqual(input)
    })

    it('input is not a formula', () => {
      const input = `hello world=HYPERLINK("https://google.com", "test link")`
      expect(sanitiseInputValue(input)).toEqual(input)
    })

    it('allowed formula in input', () => {
      const input = '=SUM(1,2)'
      expect(sanitiseInputValue(input)).toEqual(input)
    })
  })

  describe('one excel formula in input', () => {
    it('case sensitive check in input', () => {
      const input = `=hyperlink(A1, 1, 1)`
      const sanitisedInput = `'=hyperlink(A1, 1, 1)`
      expect(sanitiseInputValue(input)).toEqual(sanitisedInput)
    })

    it('input starts with =', () => {
      const input = `=HYPERLINK("https://google.com", "test link")`
      const sanitisedInput = `'=HYPERLINK("https://google.com", "test link")`
      expect(sanitiseInputValue(input)).toEqual(sanitisedInput)
    })

    it('input starts with +', () => {
      const input = `+HYPERLINK("https://google.com", "test link")`
      const sanitisedInput = `'+HYPERLINK("https://google.com", "test link")`
      expect(sanitiseInputValue(input)).toEqual(sanitisedInput)
    })
  })

  describe('multiple excel formulas in input', () => {
    it('non-nested input', () => {
      const input = `=HYPERLINK(WEBSERVICE("http://example.com/api/data"), "Click to View Data")`
      const sanitisedInput = `'=HYPERLINK(WEBSERVICE("http://example.com/api/data"), "Click to View Data")`
      expect(sanitiseInputValue(input)).toEqual(sanitisedInput)
    })

    it('nested input', () => {
      const input = `=IF(A1="Active", HYPERLINK("http://example.com/details", "Click here"), 
    IF(A1="Pending", HYPERLINK("http://example.com/pending", "Pending details"), "Inactive"))`
      const sanitisedInput = `'=IF(A1="Active", HYPERLINK("http://example.com/details", "Click here"), 
    IF(A1="Pending", HYPERLINK("http://example.com/pending", "Pending details"), "Inactive"))`
      expect(sanitiseInputValue(input)).toEqual(sanitisedInput)
    })
  })
})

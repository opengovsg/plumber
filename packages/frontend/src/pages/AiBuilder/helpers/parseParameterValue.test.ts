import { describe, expect, it } from 'vitest'

import { parseParameterValue } from './parseParameterValue'

describe('parseParameterValue', () => {
  it('returns a single text segment for a plain string', () => {
    expect(parseParameterValue('#general')).toEqual([
      { type: 'text', text: '#general' },
    ])
  })

  it('returns empty array for empty string', () => {
    expect(parseParameterValue('')).toEqual([])
  })

  it('returns a single variable segment for a lone variable', () => {
    expect(parseParameterValue('{{step.abc123.email_address}}')).toEqual([
      {
        type: 'variable',
        label: 'Email address',
        stepId: 'abc123',
        path: 'email_address',
      },
    ])
  })

  it('sentence-cases and replaces underscores for the label', () => {
    expect(parseParameterValue('{{step.abc.full_name}}')).toEqual([
      {
        type: 'variable',
        label: 'Full name',
        stepId: 'abc',
        path: 'full_name',
      },
    ])
  })

  it('uses only the last dot-separated segment of the path', () => {
    expect(parseParameterValue('{{step.abc.response.email_address}}')).toEqual([
      {
        type: 'variable',
        label: 'Email address',
        stepId: 'abc',
        path: 'response.email_address',
      },
    ])
  })

  it('handles mixed text + variable', () => {
    expect(
      parseParameterValue('Hello {{step.abc.first_name}}, welcome!'),
    ).toEqual([
      { type: 'text', text: 'Hello ' },
      {
        type: 'variable',
        label: 'First name',
        stepId: 'abc',
        path: 'first_name',
      },
      { type: 'text', text: ', welcome!' },
    ])
  })

  it('handles multiple adjacent variables', () => {
    expect(
      parseParameterValue('{{step.abc.first_name}} {{step.def.last_name}}'),
    ).toEqual([
      {
        type: 'variable',
        label: 'First name',
        stepId: 'abc',
        path: 'first_name',
      },
      { type: 'text', text: ' ' },
      {
        type: 'variable',
        label: 'Last name',
        stepId: 'def',
        path: 'last_name',
      },
    ])
  })

  it('handles all-uppercase variable path segment', () => {
    expect(parseParameterValue('{{step.abc.BODY}}')).toEqual([
      { type: 'variable', label: 'Body', stepId: 'abc', path: 'BODY' },
    ])
  })

  it('strips the hex-modifier suffix from table variables', () => {
    expect(
      parseParameterValue('{{step.abc-123-def.data|7461626c653a636f6c31}}'),
    ).toEqual([
      {
        type: 'variable',
        label: 'Data',
        stepId: 'abc-123-def',
        path: 'data',
      },
    ])
  })
})

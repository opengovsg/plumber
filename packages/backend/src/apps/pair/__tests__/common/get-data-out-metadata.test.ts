import { IExecutionStep } from '@plumber/types'

import { assert, describe, expect, it } from 'vitest'

import getDataOutMetadata from '@/apps/pair/common/get-data-out-metadata'

describe('getDataOutMetadata', () => {
  it('should return null when dataOut is null', async () => {
    const executionStep = {
      dataOut: null,
    } as IExecutionStep

    const result = await getDataOutMetadata(executionStep)
    expect(result).toBeNull()
  })

  it('should return null when dataOut is undefined', async () => {
    const executionStep = {} as IExecutionStep

    const result = await getDataOutMetadata(executionStep)
    expect(result).toBeNull()
  })

  it('should return empty object when dataOut is empty', async () => {
    const executionStep = {
      dataOut: {},
    } as unknown as IExecutionStep

    const result = await getDataOutMetadata(executionStep)

    assert(result !== null)
    expect(result).toEqual({})
  })

  it('should convert underscores to spaces in labels', async () => {
    const executionStep = {
      dataOut: {
        Signature_present: 'yes',
        Document_type: 'invoice',
      },
    } as unknown as IExecutionStep

    const result = await getDataOutMetadata(executionStep)

    assert(result !== null)
    expect(result['Signature_present']).toEqual(
      expect.objectContaining({
        label: 'Signature present',
        type: 'ai_response',
      }),
    )
    expect(result['Document_type']).toEqual(
      expect.objectContaining({ label: 'Document type', type: 'ai_response' }),
    )
  })

  it('should handle multiple underscores correctly', async () => {
    const executionStep = {
      dataOut: {
        field__with__multiple__underscores: 'value',
      },
    } as unknown as IExecutionStep

    const result = await getDataOutMetadata(executionStep)

    assert(result !== null)
    expect(result['field__with__multiple__underscores']).toEqual(
      expect.objectContaining({
        label: 'field  with  multiple  underscores',
        type: 'ai_response',
      }),
    )
  })

  it('should set type to ai_response for all fields', async () => {
    const executionStep = {
      dataOut: {
        field1: 'value1',
        field_2: 'value2',
        Field_Three: 'value3',
      },
    } as unknown as IExecutionStep

    const result = await getDataOutMetadata(executionStep)

    assert(result !== null)
    expect(result['field1'].type).toBe('ai_response')
    expect(result['field_2'].type).toBe('ai_response')
    expect(result['Field_Three'].type).toBe('ai_response')
  })

  it('should sanitize fieldNames with spaces to underscored keys', async () => {
    const executionStep = {
      dataOut: {
        field_name: 'value',
      },
      step: {
        parameters: {
          responseFields: [{ fieldName: 'field name' }],
        },
      },
    } as unknown as IExecutionStep

    const result = await getDataOutMetadata(executionStep)
    assert(result !== null)
    expect(result['field_name']).toEqual(
      expect.objectContaining({ label: 'field name', type: 'ai_response' }),
    )
  })

  it('should order metadata keys by responseFields parameter order', async () => {
    const executionStep = {
      dataOut: {
        total_amount: '150',
        sentiment: 'positive',
        summary: 'good',
      },
      step: {
        parameters: {
          responseFields: [
            { fieldName: 'summary' },
            { fieldName: 'sentiment' },
            { fieldName: 'total amount' }, // space → sanitized to total_amount
          ],
        },
      },
    } as unknown as IExecutionStep

    const result = await getDataOutMetadata(executionStep)
    assert(result !== null)
    expect(Object.keys(result)).toEqual([
      'summary',
      'sentiment',
      'total_amount',
    ])
    expect(result['summary'].order).toBe(0)
    expect(result['sentiment'].order).toBe(1)
    expect(result['total_amount'].order).toBe(2)
  })

  it('should skip responseField keys not present in dataOut', async () => {
    const executionStep = {
      dataOut: {
        summary: 'good',
      },
      step: {
        parameters: {
          responseFields: [
            { fieldName: 'summary' },
            { fieldName: 'missing field' },
          ],
        },
      },
    } as unknown as IExecutionStep

    const result = await getDataOutMetadata(executionStep)
    assert(result !== null)
    expect(Object.keys(result)).toEqual(['summary'])
  })

  it('should fall back to Object.keys(dataOut) when step parameters are absent', async () => {
    const executionStep = {
      dataOut: {
        field_a: 'a',
        field_b: 'b',
      },
    } as unknown as IExecutionStep

    const result = await getDataOutMetadata(executionStep)
    assert(result !== null)
    expect(result['field_a']).toEqual(
      expect.objectContaining({ label: 'field a', type: 'ai_response' }),
    )
    expect(result['field_b']).toEqual(
      expect.objectContaining({ label: 'field b', type: 'ai_response' }),
    )
  })
})

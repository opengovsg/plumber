import { IExecutionStep } from '@plumber/types'

import { assert, describe, expect, it } from 'vitest'

import getDataOutMetadata from '@/apps/pair/actions/process-image/get-data-out-metadata'

describe('process-image getDataOutMetadata', () => {
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

  it('should convert underscores to spaces in labels', async () => {
    const executionStep = {
      dataOut: {
        Signature_present: 'yes',
        Document_type: 'invoice',
      },
    } as unknown as IExecutionStep

    const result = await getDataOutMetadata(executionStep)

    assert(result !== null)
    expect(result['Signature_present']).toEqual({
      label: 'Signature present',
      type: 'ai_response',
    })
    expect(result['Document_type']).toEqual({
      label: 'Document type',
      type: 'ai_response',
    })
  })

  it('should handle field names without underscores', async () => {
    const executionStep = {
      dataOut: {
        signature: 'yes',
        confidence: '0.95',
      },
    } as unknown as IExecutionStep

    const result = await getDataOutMetadata(executionStep)

    assert(result !== null)
    expect(result['signature']).toEqual({
      label: 'signature',
      type: 'ai_response',
    })
    expect(result['confidence']).toEqual({
      label: 'confidence',
      type: 'ai_response',
    })
  })

  it('should handle multiple underscores correctly', async () => {
    const executionStep = {
      dataOut: {
        field__with__multiple__underscores: 'value',
      },
    } as unknown as IExecutionStep

    const result = await getDataOutMetadata(executionStep)

    assert(result !== null)
    expect(result['field__with__multiple__underscores']).toEqual({
      label: 'field  with  multiple  underscores',
      type: 'ai_response',
    })
  })

  it('should handle mixed fields with and without underscores', async () => {
    const executionStep = {
      dataOut: {
        Signature_present: 'yes',
        Document_type: 'invoice',
        confidence: '0.95',
        total_amount: '150.00',
      },
    } as unknown as IExecutionStep

    const result = await getDataOutMetadata(executionStep)

    assert(result !== null)
    expect(Object.keys(result)).toHaveLength(4)
    expect(result['Signature_present'].label).toBe('Signature present')
    expect(result['Document_type'].label).toBe('Document type')
    expect(result['confidence'].label).toBe('confidence')
    expect(result['total_amount'].label).toBe('total amount')
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

  it('should return empty object when dataOut is empty object', async () => {
    const executionStep = {
      dataOut: {},
    } as unknown as IExecutionStep

    const result = await getDataOutMetadata(executionStep)

    assert(result !== null)
    expect(result).toEqual({})
  })
})

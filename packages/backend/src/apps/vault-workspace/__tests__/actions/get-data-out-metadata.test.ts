import { IExecutionStep } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import getDataOutMetadata from '../../actions/get-table-data/get-data-out-metadata'
import { VAULT_ID } from '../../common/constants'

function convertKeyToHex(key: string) {
  return Buffer.from(key).toString('hex')
}

describe('Test getDataOutMetadata', () => {
  it('vault metadata example that has not dataOut (should not occur)', async () => {
    const testExecutionStep = {
      empty: '',
    } as unknown as IExecutionStep
    const testMetadata = await getDataOutMetadata(testExecutionStep)
    expect(testMetadata).toBeNull()
  })

  it('vault metadata example that is not keysEncoded (should not occur)', async () => {
    const testExecutionStep = {
      dataOut: {
        _metadata: {},
      },
    } as unknown as IExecutionStep
    const testMetadata = await getDataOutMetadata(testExecutionStep)
    expect(testMetadata).toBeNull()
  })

  it('vault metadata example that is keysEncoded', async () => {
    const testLabel1 = 'test label 1'
    const testLabel2 = 'test label 2'
    const testLabel1InHex = convertKeyToHex(testLabel1)
    const testLabel2InHex = convertKeyToHex(testLabel2)
    const testExecutionStep = {
      dataOut: {
        [VAULT_ID]: '123',
        [testLabel1InHex]: 'test value 1',
        [testLabel2InHex]: 'test value 2',
        _metadata: {
          success: true,
          rowsFound: 2,
          keysEncoded: true,
        },
      },
    } as unknown as IExecutionStep
    const testMetadata = await getDataOutMetadata(testExecutionStep)
    const outputMetadata = {
      [testLabel1InHex]: {
        label: testLabel1,
      },
      [testLabel2InHex]: {
        label: testLabel2,
      },
      _metadata: {
        label: '',
      },
      '_metadata.keysEncoded': {
        isHidden: true,
      },
    }
    expect(testMetadata).toEqual(outputMetadata)
  })
})

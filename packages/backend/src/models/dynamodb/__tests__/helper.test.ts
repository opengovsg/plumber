import { ElectroError } from 'electrodb'
import { describe, expect, it } from 'vitest'

import RetriableError from '@/errors/retriable-error'
import TableColumnMetadata from '@/models/table-column-metadata'

import {
  autoMarshallDataObj,
  handleDynamoDBError,
  mapColumnIdsToNames,
  stripInvalidKeys,
} from '../helpers'

describe('dynamodb helpers', () => {
  describe('auto marshall data value types', () => {
    it('should correctly identify numberic strings', () => {
      const rawValue = {
        text: 'abc',
        int: '123',
        negativeInt: '-123',
        float: '12.444',
        negativeFloat: '-12.444',
        invalidFloat: '12.444.444',
        invalidNegativeFloat: '--12.444',
        numberExceedingMaxSafe: '9007199254740992',
        numberUnderMinSafe: '-9007199254740992',
        exponential: '1e+3',
        mixed: '123abc',
      }

      expect(autoMarshallDataObj(rawValue)).toEqual({
        text: 'abc',
        int: 123,
        negativeInt: -123,
        float: 12.444,
        negativeFloat: -12.444,
        invalidFloat: '12.444.444',
        invalidNegativeFloat: '--12.444',
        numberExceedingMaxSafe: '9007199254740992',
        numberUnderMinSafe: '-9007199254740992',
        exponential: '1e+3',
        mixed: '123abc',
      })
    })
    it('should leave unknown types as is', () => {
      const rawValue = {
        bool: true,
        undefined: undefined,
        null: null,
        date: new Date(),
      } as unknown as Record<string, string> // for bypassing type checks

      expect(autoMarshallDataObj(rawValue)).toEqual(rawValue)
    })
  })

  describe('map column ids to names', () => {
    it('should map column ids to names correct', () => {
      const columns = [
        { id: '1', name: 'name1' },
        { id: '2', name: 'name2' },
        { id: '3', name: 'name3' },
      ] as TableColumnMetadata[]
      const data = {
        '1': 'value1',
        '2': 'value2',
        '3': 'value3',
      }
      expect(mapColumnIdsToNames(data, columns)).toEqual({
        name1: 'value1',
        name2: 'value2',
        name3: 'value3',
      })
    })

    it('should strip away unknown column ids', () => {
      const columns = [
        { id: '1', name: 'name1' },
        { id: '3', name: 'name3' },
      ] as TableColumnMetadata[]
      const data = {
        '1': 'value1',
        '2': 'value2',
        '3': 'value3',
      }
      expect(mapColumnIdsToNames(data, columns)).toEqual({
        name1: 'value1',
        name3: 'value3',
      })
    })
  })

  describe('strip invalid keys', () => {
    it('should strip away unknown column ids', () => {
      const columnIds = ['1', '3']
      const data = {
        '1': 'value1',
        '2': 'value2',
        '3': 'value3',
      }
      expect(stripInvalidKeys({ columnIds, data })).toEqual({
        '1': 'value1',
        '3': 'value3',
      })
    })
  })

  describe('error handling', () => {
    it('should handle retriable errors', () => {
      const errMsg =
        'Throughput exceeds the current capacity of your table or index. DynamoDB is automatically scaling your table or index so please try again shortly. If exceptions persist, check if you have a hot key: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html'
      const throughputExceededError = Object.setPrototypeOf(
        {
          message: errMsg,
          code: 4001,
          cause: {
            message: errMsg,
          },
        },
        ElectroError.prototype,
      )
      expect(() => handleDynamoDBError(throughputExceededError)).toThrow(
        RetriableError,
      )
    })

    it('should handle non-retriable errors', () => {
      const errMsg =
        'Number 202203297227616030000 is greater than Number.MAX_SAFE_INTEGER. Use BigInt.'
      const dataTypeError = Object.setPrototypeOf(
        {
          message: errMsg,
          code: 4001,
          cause: {
            message: errMsg,
          },
        },
        ElectroError.prototype,
      )
      expect(() => handleDynamoDBError(dataTypeError)).not.toThrow(
        RetriableError,
      )
    })
  })
})

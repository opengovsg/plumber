import { IFieldText } from '@plumber/types'

import { cloneDeep } from 'lodash'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createSelectTransformDropdown,
  SELECT_TRANSFORM_DROPDOWN_FIELD_KEY,
  VALUE_TO_TRANSFORM_FIELD,
  VALUE_TO_TRANSFORM_FIELD_KEY,
} from '../common/fixed-fields'
import { setUpActionFields } from '../common/set-up-action-fields'
import { type TransformSpec } from '../common/transform-spec'

const SAMPLE_COMMON_FIELD = {
  label: 'Sample Common field',
  key: 'sampleCommonField',
  type: 'string' as const,
  required: true,
  variables: true,
} satisfies IFieldText

const SAMPLE_TRANSFORM_ONE = {
  id: 'sampleTransformOne',
  dropdownConfig: {
    label: 'Sample Transform One',
    description: 'The first sample transform',
  },
  fields: [
    {
      label: 'Price',
      key: 'sampleTransformOnePrice',
      type: 'string' as const,
      required: true,
      variables: true,
    },
  ],
  transformData: async () => {
    return
  },
} satisfies TransformSpec

const SAMPLE_TRANSFORM_TWO = {
  id: 'sampleTransformTwo',
  dropdownConfig: {
    label: 'Sample Transform Two',
    description: 'The second sample transform',
  },
  fields: [
    {
      label: 'Sparrow Species',
      key: 'sampleTransformOneSparrowSpecies',
      type: 'string' as const,
      required: true,
      variables: true,
    },
  ],
  transformData: async () => {
    return
  },
} satisfies TransformSpec

describe('Common utility functions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('fixed fields (value to transform, transforms dropdown)', () => {
    it('populates the "select transform" dropdown from the specs', () => {
      const dropdown = createSelectTransformDropdown([
        SAMPLE_TRANSFORM_ONE,
        SAMPLE_TRANSFORM_TWO,
      ])

      expect(dropdown.options).toContainEqual({
        ...SAMPLE_TRANSFORM_ONE.dropdownConfig,
        value: SAMPLE_TRANSFORM_ONE.id,
      })
      expect(dropdown.options).toContainEqual({
        ...SAMPLE_TRANSFORM_TWO.dropdownConfig,
        value: SAMPLE_TRANSFORM_TWO.id,
      })
    })

    it('fixed fields use the correct keys', () => {
      expect(VALUE_TO_TRANSFORM_FIELD.key).toEqual(VALUE_TO_TRANSFORM_FIELD_KEY)

      const dropdown = createSelectTransformDropdown([])
      expect(dropdown.key).toEqual(SELECT_TRANSFORM_DROPDOWN_FIELD_KEY)
    })
  })

  describe('set up action fields', () => {
    // Deep clone arguments as setUpActionFields modifies the input object.
    let sampleArgs: Parameters<typeof setUpActionFields>[0]

    beforeEach(() => {
      sampleArgs = cloneDeep({
        commonFields: [SAMPLE_COMMON_FIELD],
        transforms: [SAMPLE_TRANSFORM_ONE, SAMPLE_TRANSFORM_TWO],
      })
    })

    it("result has fixed fields, common fields and each transform's fields in the input order", () => {
      const actionFields = setUpActionFields(sampleArgs)
      const expectedSelectTransformDropdown = createSelectTransformDropdown(
        sampleArgs.transforms,
      )

      // We use lots of objectContaing as the function inserts hiddenIf into the
      // fields, and these will be tested in a sepearate unit test.
      expect(actionFields).toEqual([
        // Fixed fields
        expect.objectContaining(expectedSelectTransformDropdown),
        expect.objectContaining(VALUE_TO_TRANSFORM_FIELD),

        // Common fields
        expect.objectContaining(SAMPLE_COMMON_FIELD),

        // Transforms' fields
        expect.objectContaining(SAMPLE_TRANSFORM_ONE.fields[0]),
        expect.objectContaining(SAMPLE_TRANSFORM_TWO.fields[0]),
      ])
    })

    it("hides each transform's fields until they are chosen", () => {
      const actionFields = setUpActionFields(sampleArgs)

      expect(actionFields).toEqual(
        expect.arrayContaining([
          ...SAMPLE_TRANSFORM_ONE.fields.map((field) =>
            expect.objectContaining({
              ...field,
              hiddenIf: {
                fieldKey: SELECT_TRANSFORM_DROPDOWN_FIELD_KEY,
                op: 'not_equals',
                fieldValue: SAMPLE_TRANSFORM_ONE.id,
              },
            }),
          ),
          ...SAMPLE_TRANSFORM_TWO.fields.map((field) =>
            expect.objectContaining({
              ...field,
              hiddenIf: {
                fieldKey: SELECT_TRANSFORM_DROPDOWN_FIELD_KEY,
                op: 'not_equals',
                fieldValue: SAMPLE_TRANSFORM_TWO.id,
              },
            }),
          ),
        ]),
      )
    })

    it('hides common fields until a transform is chosen', () => {
      const actionFields = setUpActionFields(sampleArgs)

      expect(actionFields).toEqual(
        expect.arrayContaining([
          {
            ...SAMPLE_COMMON_FIELD,
            hiddenIf: {
              fieldKey: SELECT_TRANSFORM_DROPDOWN_FIELD_KEY,
              op: 'is_empty',
            },
          },
        ]),
      )
    })
  })
})

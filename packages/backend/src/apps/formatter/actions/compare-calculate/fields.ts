import type { IField } from '@plumber/types'

import z from 'zod'

import { ensureZodObjectKey } from '@/helpers/zod-utils'

import {
  inputFormatOptions,
  supportedFormats,
} from '../date-time/common/date-time-format'
import { timeUnitEnum, timeUnitOptions } from '../date-time/common/time-units'

//
// Enums (shared by fields + run logic)
//

export const operationEnum = z.enum(['compare', 'gap', 'calculate'])
export const compareOpEnum = z.enum([
  'before',
  'after',
  'onOrBefore',
  'onOrAfter',
  'sameDay',
])
export const gapOpEnum = z.enum(['within', 'moreBefore', 'moreAfter'])
// One shared list of time units across all date actions. Re-exported so
// logic.ts keeps importing `unitEnum` from here.
export const unitEnum = timeUnitEnum

// The amount + unit pair for the time-gap check, kept as a single row so they
// render on one line (consistent with add/subtract's amount + unit columns).
export const gapPeriodSchema = z.object({
  gapAmount: z.string(),
  gapUnit: unitEnum,
})

//
// Parameter schema
//

export const paramsSchema = z.object({
  operation: operationEnum,

  firstDateFormat: supportedFormats,
  firstDateValue: z.string().optional().default(''),
  secondDateFormat: supportedFormats,
  secondDateValue: z.string().optional().default(''),

  // Compare ("Compare two dates")
  compareOperator: compareOpEnum.optional(),

  // Gap ("Check time gap between dates")
  gapOperator: gapOpEnum.optional(),
  gapPeriod: z.array(gapPeriodSchema).optional(),

  // Calculate ("Calculate time between dates")
  diffUnit: unitEnum.optional(),
})

const key = (k: keyof z.infer<typeof paramsSchema>): string =>
  ensureZodObjectKey(paramsSchema, k)

//
// Field options
//

const operationOptions = [
  {
    label: 'Compare two dates',
    description:
      'Is one date before / after / the same as another? Gives a true / false answer to use in an "If... then" step',
    value: operationEnum.enum.compare,
  },
  {
    label: 'Check time gap between dates',
    description:
      'Are two dates within / more than a period apart? Gives a true / false answer to use in an "If... then" step',
    value: operationEnum.enum.gap,
  },
  {
    label: 'Calculate time between dates',
    description:
      'Get the number of days / weeks / months between two dates — a number you can use in messages or calculations',
    value: operationEnum.enum.calculate,
  },
]

const compareOperatorOptions = [
  { label: 'before the second date', value: compareOpEnum.enum.before },
  { label: 'after the second date', value: compareOpEnum.enum.after },
  { label: 'on or before the second date', value: compareOpEnum.enum.onOrBefore },
  { label: 'on or after the second date', value: compareOpEnum.enum.onOrAfter },
  {
    label: 'on the same day as the second date',
    value: compareOpEnum.enum.sameDay,
  },
]

const gapOperatorOptions = [
  {
    label: 'within a certain time of the second date',
    value: gapOpEnum.enum.within,
  },
  {
    label: 'more than a certain time before the second date',
    value: gapOpEnum.enum.moreBefore,
  },
  {
    label: 'more than a certain time after the second date',
    value: gapOpEnum.enum.moreAfter,
  },
]

//
// Field definitions
//
// NOTE (prototype): `hiddenIf` currently supports only ONE condition, so:
// - The two date operands are always shown (not gated on the operation), which
//   lets each value field use its single condition to hide itself when its
//   format is "Now".
// - Each operation's extra fields are gated on the operation dropdown.
// See prototype notes for the field-visibility constraint discussion.
//

const hiddenUnlessOperation = (op: string): IField['hiddenIf'] => ({
  fieldKey: key('operation'),
  op: 'not_equals',
  fieldValue: op,
})

export const fields: IField[] = [
  {
    label: 'What do you want to do?',
    key: key('operation'),
    type: 'dropdown',
    required: true,
    variables: false,
    showOptionValue: false,
    options: operationOptions,
  },

  // ---- First date (operand A) ----
  // Value first, then format — matching the field order of the
  // "Format date / time" action for consistency.
  {
    label: 'First date',
    key: key('firstDateValue'),
    type: 'string',
    required: true,
    variables: true,
    hiddenIf: {
      fieldKey: key('firstDateFormat'),
      op: 'equals',
      fieldValue: supportedFormats.enum.now,
    },
  },
  {
    label: 'Format of the first date',
    key: key('firstDateFormat'),
    type: 'dropdown',
    required: true,
    variables: false,
    showOptionValue: false,
    options: inputFormatOptions,
  },

  // ---- Second date (operand B) ----
  {
    label: 'Second date',
    key: key('secondDateValue'),
    type: 'string',
    required: true,
    variables: true,
    hiddenIf: {
      fieldKey: key('secondDateFormat'),
      op: 'equals',
      fieldValue: supportedFormats.enum.now,
    },
  },
  {
    label: 'Format of the second date',
    key: key('secondDateFormat'),
    type: 'dropdown',
    required: true,
    variables: false,
    showOptionValue: false,
    options: inputFormatOptions,
  },

  // ---- Compare ----
  {
    label: 'The first date is…',
    key: key('compareOperator'),
    type: 'dropdown',
    required: true,
    variables: false,
    showOptionValue: false,
    options: compareOperatorOptions,
    hiddenIf: hiddenUnlessOperation(operationEnum.enum.compare),
  },

  // ---- Gap ----
  {
    label: 'The first date is…',
    key: key('gapOperator'),
    type: 'dropdown',
    required: true,
    variables: false,
    showOptionValue: false,
    options: gapOperatorOptions,
    hiddenIf: hiddenUnlessOperation(operationEnum.enum.gap),
  },
  {
    // Amount + unit on one row (multirow-multicol), mirroring add/subtract's
    // amount + unit columns. The amount is a literal number (variables off), so
    // no "No variables available" panel shows.
    // PROTOTYPE LIMITATION: multirow-multicol always renders an "Add" button,
    // so users can add extra (ignored) rows. Only the first row is used. The
    // proper fix is a non-repeating / maxRows=1 variant of this field.
    label: 'How much time?',
    key: key('gapPeriod'),
    type: 'multirow-multicol',
    required: true,
    subFields: [
      {
        placeholder: 'e.g. 2',
        key: ensureZodObjectKey(gapPeriodSchema, 'gapAmount'),
        type: 'string',
        required: true,
        variables: false,
        customStyle: { flex: 2 },
      },
      {
        placeholder: 'Unit of time',
        key: ensureZodObjectKey(gapPeriodSchema, 'gapUnit'),
        type: 'dropdown',
        required: true,
        variables: false,
        showOptionValue: false,
        options: timeUnitOptions,
        customStyle: { flex: 3 },
      },
    ],
    hiddenIf: hiddenUnlessOperation(operationEnum.enum.gap),
  },

  // ---- Calculate ----
  {
    label: 'Show the result in',
    key: key('diffUnit'),
    type: 'dropdown',
    required: true,
    variables: false,
    showOptionValue: false,
    options: timeUnitOptions,
    hiddenIf: hiddenUnlessOperation(operationEnum.enum.calculate),
  },
]

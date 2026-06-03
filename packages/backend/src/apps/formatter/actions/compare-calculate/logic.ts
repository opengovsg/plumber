import { DateTime } from 'luxon'
import type z from 'zod'

import { commonDateFormats } from '../date-time/common/date-format-options'
import {
  parseDateTime,
  SG_TIMEZONE,
  type supportedFormats,
} from '../date-time/common/date-time-format'

import type { compareOpEnum, gapOpEnum, unitEnum } from './fields'

type SupportedFormat = z.infer<typeof supportedFormats>
type CompareOp = z.infer<typeof compareOpEnum>
type GapOp = z.infer<typeof gapOpEnum>
type Unit = z.infer<typeof unitEnum>

// Formats that carry no timezone information. We re-interpret their wall-clock
// time as Singapore time so that everything is compared in one consistent zone.
//
// PROTOTYPE NOTE: in the full implementation this SG pinning should live inside
// the shared parser so that the existing convert / add-subtract transforms get
// it too, rather than being applied here per-operand.
const ZONELESS_FORMATS = new Set<SupportedFormat>([
  ...commonDateFormats,
  'formsgDateField',
])

/**
 * Parses one of the two date operands into a Singapore-time DateTime.
 *
 * "Now" and "Excel serial" are already produced in SG time by the shared
 * converters. Zoneless formats have their wall-clock time re-interpreted as SG
 * time; zoned formats (ISO / FormSG submission time) are converted to the same
 * instant expressed in SG time.
 */
export function parseOperand(
  format: SupportedFormat,
  value: string,
): DateTime {
  const parsed = parseDateTime(format, value)

  if (ZONELESS_FORMATS.has(format)) {
    return parsed.setZone(SG_TIMEZONE, { keepLocalTime: true })
  }

  return parsed.setZone(SG_TIMEZONE)
}

// NOTE: `type` (not `interface`) so these satisfy `IJSONObject`'s index
// signature when passed to `$.setActionItem({ raw })`.
export type CompareResult = {
  result: 'true' | 'false'
  summary: string
}

// Plain-language phrasing for each comparison, used in the readable summary.
const COMPARE_PHRASE: Record<CompareOp, string> = {
  before: 'before',
  after: 'after',
  onOrBefore: 'on or before',
  onOrAfter: 'on or after',
  sameDay: 'on the same day as',
}

export function computeComparison(
  first: DateTime,
  operator: CompareOp,
  second: DateTime,
): CompareResult {
  let result: boolean

  switch (operator) {
    case 'before':
      result = first < second
      break
    case 'after':
      result = first > second
      break
    case 'onOrBefore':
      result = first <= second
      break
    case 'onOrAfter':
      result = first >= second
      break
    case 'sameDay':
      result = first.hasSame(second, 'day')
      break
  }

  return {
    result: result ? 'true' : 'false',
    summary: `The first date is ${COMPARE_PHRASE[operator]} the second date: ${
      result ? 'Yes' : 'No'
    }`,
  }
}

export type GapResult = {
  result: 'true' | 'false'
  summary: string
}

/**
 * Time-gap checks. "First" / "second" refer to the two operands A and B.
 * - within:     |A − B| ≤ amount
 * - moreBefore: A is earlier than B by more than amount  (B − A > amount)
 * - moreAfter:  A is later than B by more than amount     (A − B > amount)
 */
export function computeGap(
  first: DateTime,
  operator: GapOp,
  amount: number,
  unit: Unit,
  second: DateTime,
): GapResult {
  const aMinusB = first.diff(second, unit).as(unit)
  const bMinusA = second.diff(first, unit).as(unit)

  let result: boolean

  switch (operator) {
    case 'within':
      result = Math.abs(aMinusB) <= amount
      break
    case 'moreBefore':
      result = bMinusA > amount
      break
    case 'moreAfter':
      result = aMinusB > amount
      break
  }

  const yesNo = result ? 'Yes' : 'No'
  let summary: string
  switch (operator) {
    case 'within':
      summary = `The two dates are within ${amount} ${unit} of each other: ${yesNo}`
      break
    case 'moreBefore':
      summary = `The first date is more than ${amount} ${unit} before the second date: ${yesNo}`
      break
    case 'moreAfter':
      summary = `The first date is more than ${amount} ${unit} after the second date: ${yesNo}`
      break
  }

  return {
    result: result ? 'true' : 'false',
    summary,
  }
}

export type DifferenceResult = {
  // Signed whole number, measured from the first date to the second (B − A).
  // Positive means the second date is later.
  result: number
  // Magnitude, for users who just want "how many days since ...".
  absolute: number
  unit: Unit
  // Plain-language version of the result.
  summary: string
}

export function computeDifference(
  first: DateTime,
  second: DateTime,
  unit: Unit,
): DifferenceResult {
  // Calendar-aware diff (Luxon handles varying month/year lengths).
  const signedExact = second.diff(first, unit).as(unit)
  const signed = Math.trunc(signedExact)
  const absolute = Math.abs(signed)

  const summary =
    signed === 0
      ? `The two dates are less than 1 ${unit.replace(/s$/, '')} apart`
      : `The second date is ${absolute} ${unit} ${
          signed > 0 ? 'after' : 'before'
        } the first date`

  return {
    result: signed,
    absolute,
    unit,
    summary,
  }
}

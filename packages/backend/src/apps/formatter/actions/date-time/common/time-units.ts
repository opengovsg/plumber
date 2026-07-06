import { type DurationLikeObject } from 'luxon'
import z from 'zod'

/**
 * The single list of time units shared by every date action (add/subtract,
 * compare, time gap, calculate between) so the options stay consistent.
 *
 * Keys match Luxon `Duration` keys so they can be passed straight to date math.
 */
export const timeUnitEnum = z.enum([
  'seconds',
  'minutes',
  'hours',
  'days',
  'weeks',
  'months',
  'years',
] as const satisfies ReadonlyArray<keyof DurationLikeObject>)

function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const timeUnitOptions = timeUnitEnum.options.map((unit) => ({
  label: sentenceCase(unit),
  value: unit,
}))

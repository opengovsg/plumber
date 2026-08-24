/**
 * Budget for the field half of a condition sentence — the half that has
 * something after it. Capping it is what guarantees the operator and the value
 * still get shown; the value half is deliberately left uncapped and clipped by
 * the block's own width instead (see ConditionBlockHeader).
 *
 * At the 320px minimum block width, two lines of body-2 hold roughly 76
 * characters, so 24 leaves the operator and a useful amount of value visible
 * alongside the keyword badge.
 *
 * Deliberately a character count rather than a CSS `max-width`: `ch` units
 * measure the "0" glyph, and in a proportional font that buys wildly different
 * amounts of real text, which defeats the point of reserving a known share.
 */
export const MAX_CONDITION_LABEL_LENGTH = 24

/**
 * Trailing characters worth dropping before the ellipsis. FormSG builds labels
 * like "2. Row 1 Postal Code - Delivery addresses", where the cut lands right
 * after the separator and would otherwise read "2. Row 1 Postal Code - …".
 */
const TRAILING_SEPARATORS = /[\s\-–—,.:;/(&]+$/

/**
 * Shortens one part of the sentence to the shared budget. Returns the label
 * unchanged when it already fits, so callers can compare the two to tell
 * whether anything was actually cut.
 */
export function truncateConditionLabel(label: string): string {
  if (label.length <= MAX_CONDITION_LABEL_LENGTH) {
    return label
  }

  const cut = label
    .slice(0, MAX_CONDITION_LABEL_LENGTH - 1)
    .replace(TRAILING_SEPARATORS, '')

  return `${cut}…`
}

/**
 * Character budget for the field half of a condition sentence, so the operator
 * and the value stay visible.
 *
 * IMPORTANT: a `ch` max-width would measure the "0" glyph, which buys
 * unpredictable amounts of proportional text.
 */
export const MAX_CONDITION_LABEL_LENGTH = 24

/**
 * Trailing characters worth dropping before the ellipsis, so a cut FormSG
 * label does not read "2. Row 1 Postal Code - …".
 */
const TRAILING_SEPARATORS = /[\s\-–—,.:;/(&]+$/

/** Shortens one part of the sentence to the shared budget. */
export function truncateConditionLabel(label: string): string {
  if (label.length <= MAX_CONDITION_LABEL_LENGTH) {
    return label
  }

  const cut = label
    .slice(0, MAX_CONDITION_LABEL_LENGTH - 1)
    .replace(TRAILING_SEPARATORS, '')

  return `${cut}…`
}

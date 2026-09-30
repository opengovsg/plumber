import type { IField, IJSONObject } from '@plumber/types'

/**
 * Keeps only the parameters an action or trigger declares.
 *
 * A tabbed field stores its selection under a sibling key with no field of
 * its own, so that key is allowed alongside the field's own key. Its value is
 * checked against the declared options because the editor would otherwise
 * show a pill the AI never picked.
 */
export function filterStepParameters(
  fields: IField[] | undefined,
  parameters: Record<string, unknown>,
): IJSONObject {
  const allowedKeys = new Set<string>()

  for (const field of fields ?? []) {
    allowedKeys.add(field.key)

    const tabs = 'tabs' in field ? field.tabs : undefined
    if (!tabs) {
      continue
    }
    allowedKeys.add(tabs.key)

    const tabValue = parameters[tabs.key]
    if (tabValue === undefined) {
      continue
    }
    const allowedValues = tabs.options.map((o) => o.value)
    if (!allowedValues.includes(tabValue as string)) {
      throw new Error(
        `Invalid value for '${tabs.key}'. Expected one of: ${allowedValues.join(
          ', ',
        )}`,
      )
    }
  }

  return Object.fromEntries(
    Object.entries(parameters).filter(([k]) => allowedKeys.has(k)),
  ) as IJSONObject
}

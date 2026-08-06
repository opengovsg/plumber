import type { IApp } from '@plumber/types'

function camelToSentence(key: string): string {
  const words = key.replace(/([A-Z])/g, ' $1').trim()
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase()
}

export function getStepFields(
  allApps: IApp[],
  appKey: string,
  stepKey: string,
) {
  const app = allApps.find((a) => a.key === appKey)
  if (!app) {
    return []
  }
  const trigger = app.triggers?.find((t) => t.key === stepKey)
  const action = app.actions?.find((a) => a.key === stepKey)
  return [
    ...(trigger?.substeps?.flatMap((s) => s.arguments ?? []) ?? []),
    ...(action?.substeps?.flatMap((s) => s.arguments ?? []) ?? []),
  ]
}

export function resolveFieldLabel(
  fields: ReturnType<typeof getStepFields>,
  paramKey: string,
): string {
  return (
    fields.find((f) => f.key === paramKey)?.label ?? camelToSentence(paramKey)
  )
}

export type FieldWithOptions = {
  key?: string
  options?: Array<{ label: string; value: string | number | boolean }>
  subFields?: FieldWithOptions[]
}

// Resolve a single scalar value against a field's option list.
export function resolveOptionLabel(
  field: FieldWithOptions | undefined,
  strValue: string,
): string {
  const option = field?.options?.find((o) => String(o.value) === strValue)
  return option ? option.label : strValue
}

// Flatten a single row object (e.g. one Tile row, one if-then condition) into
// a display string, resolving option labels from subField definitions.
function flattenRow(
  value: unknown,
  subFields?: FieldWithOptions[],
): string | null {
  if (typeof value !== 'object' || value === null) {
    return String(value)
  }

  const obj = value as Record<string, unknown>
  // Follow subField definition order if available; otherwise use object key order
  const keys = subFields
    ? subFields
        .map((f) => f.key)
        .filter((k): k is string => k != null && k in obj)
    : Object.keys(obj)
  const parts = keys
    .filter((k) => obj[k] !== '' && obj[k] != null)
    .map((k) => {
      const subField = subFields?.find((f) => f.key === k)
      // obj[k] is assumed scalar here: no current app schema nests a
      // multirow/multirow-multicol subField inside another one's subFields,
      // even though IField's type allows it. If that ever changes, this
      // needs a typeof-object branch that recurses into flattenRow instead
      // of stringifying — see PR #1864 review discussion.
      return resolveOptionLabel(subField, String(obj[k]))
    })
  return parts.length > 0 ? parts.join(' ') : null
}

// Resolve a parameter's value into one or more display lines. Multirow/
// multirow-multicol values (e.g. Tile row data, if-then conditions) produce
// one line per row, so each renders on its own line rather than being
// squashed into a single comma-joined paragraph.
export function resolveDisplayValue(
  fields: ReturnType<typeof getStepFields>,
  paramKey: string,
  value: unknown,
): string[] {
  const field = fields.find((f) => f.key === paramKey) as
    | FieldWithOptions
    | undefined

  if (Array.isArray(value)) {
    return value
      .map((item) => flattenRow(item, field?.subFields))
      .filter((line): line is string => line !== null && line !== '')
  }

  if (typeof value === 'object' && value !== null) {
    const line = flattenRow(value, field?.subFields)
    return line !== null && line !== '' ? [line] : []
  }

  // For scalar values, resolve option label if the field has static options
  return [resolveOptionLabel(field, String(value))]
}

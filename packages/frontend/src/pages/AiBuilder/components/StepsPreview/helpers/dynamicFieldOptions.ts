import type {
  IField,
  IFieldDropdownOption,
  IFieldDropdownSource,
  IJSONObject,
} from '@plumber/types'
import { get, set } from 'lodash'

export interface DynamicField {
  fieldKey: string
  source: IFieldDropdownSource
}

// A field is a "dynamic dropdown" (e.g. Tile's columnId, Excel's columnName,
// LetterSG's field) when it's backed by a `getDynamicData` source — its
// options only exist behind a live query, not in the static app schema.
// Shared by collectDynamicFields (which fields need fetching) and the
// Column/Value table's shape detection (which subField is "the column").
export function getDynamicDropdownSource(
  field: IField,
): IFieldDropdownSource | null {
  if (
    field.type !== 'dropdown' ||
    field.source?.type !== 'query' ||
    field.source.name !== 'getDynamicData'
  ) {
    return null
  }
  return field.source
}

// Fields backed by a `getDynamicData` source have no static `options` — their
// labels only exist behind a live query. Walk the step schema (including
// subFields, since Tile's columnId lives inside multirow-multicol subFields)
// to find every such field.
export function collectDynamicFields(fields: IField[]): DynamicField[] {
  const result: DynamicField[] = []
  for (const field of fields) {
    const source = getDynamicDropdownSource(field)
    if (source) {
      result.push({ fieldKey: field.key, source })
    }
    const subFields = (field as { subFields?: IField[] }).subFields
    if (subFields) {
      result.push(...collectDynamicFields(subFields))
    }
  }
  return result
}

// Resolve a getDynamicData source's arguments (e.g. `{ name: 'parameters.tableId',
// value: '{parameters.tableId}' }`) against the step's own parameters, mirroring
// the resolution done for the live form in useDynamicData.ts.
export function resolveDynamicSourceVariables(
  source: IFieldDropdownSource,
  parameters: IJSONObject,
): { key: string; queryParameters: IJSONObject } | null {
  let key: string | undefined
  const queryVariables: Record<string, unknown> = {}

  for (const { name, value } of source.arguments) {
    const isTemplate = value.startsWith('{') && value.endsWith('}')
    if (!isTemplate) {
      if (name === 'key') {
        key = value
      }
      continue
    }

    const formPath = value.slice(1, -1)
    const paramPath = formPath.startsWith('parameters.')
      ? formPath.slice('parameters.'.length)
      : formPath
    const resolved = get(parameters, paramPath)
    if (resolved == null) {
      return null
    }
    set(queryVariables, name, resolved)
  }

  if (!key) {
    return null
  }

  return {
    key,
    queryParameters: (queryVariables.parameters as IJSONObject) ?? {},
  }
}

// Overlay fetched dynamic options onto a field schema so resolveOptionLabel/
// flattenValue can resolve them exactly like static options.
export function withDynamicOptions(
  fields: IField[],
  dynamicOptionsByKey: Map<string, IFieldDropdownOption[]>,
): IField[] {
  return fields.map((field) => {
    const subFields = (field as { subFields?: IField[] }).subFields
    const dynamicOptions = dynamicOptionsByKey.get(field.key)
    return {
      ...field,
      ...(dynamicOptions ? { options: dynamicOptions } : {}),
      ...(subFields
        ? { subFields: withDynamicOptions(subFields, dynamicOptionsByKey) }
        : {}),
    } as IField
  })
}

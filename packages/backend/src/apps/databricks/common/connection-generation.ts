// TODO(PLU-1172): Delete the legacy Databricks path after every user has moved.
export const DATABRICKS_GENERATIONS = ['legacy', 'new'] as const

export type DatabricksGeneration = (typeof DATABRICKS_GENERATIONS)[number]

export function parseDatabricksGeneration(
  generation: unknown,
): DatabricksGeneration {
  if (generation === undefined || generation === null) {
    return 'legacy'
  }
  if (generation === 'legacy' || generation === 'new') {
    return generation
  }
  throw new Error('Unknown Databricks generation')
}

// A bad stored value must not fail a connection read. Writes still use the strict parse.
export function readDatabricksGeneration(
  generation: unknown,
): DatabricksGeneration | null {
  if (
    generation === undefined ||
    generation === null ||
    generation === 'legacy' ||
    generation === 'new'
  ) {
    return parseDatabricksGeneration(generation)
  }
  return null
}

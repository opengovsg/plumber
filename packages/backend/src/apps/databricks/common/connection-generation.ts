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

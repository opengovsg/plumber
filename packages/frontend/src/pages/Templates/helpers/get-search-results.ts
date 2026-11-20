import type { ITemplate } from '@plumber/types'

export type ListedTemplate = ITemplate & { isBuiltIn?: boolean }

/**
 * Drops matches the page hides, such as the Pair template variant, before
 * taking the top results.
 */
export function getSearchResults({
  matchedTemplateIds,
  templates,
  limit,
}: {
  matchedTemplateIds: readonly string[]
  templates: readonly ListedTemplate[]
  limit: number
}): ListedTemplate[] {
  return matchedTemplateIds
    .flatMap((id) => templates.find((template) => template.id === id) ?? [])
    .slice(0, limit)
}

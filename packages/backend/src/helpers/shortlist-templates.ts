import type { ITemplate } from '@plumber/types'

import { TEMPLATES } from '@/db/storage'

export const COMMUNITY_SEARCH_LIMIT = 20

const BUILT_IN_IDS = new Set(TEMPLATES.map(({ id }) => id))

function words(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
}

function score(template: ITemplate, queryWords: Set<string>): number {
  const appKeys = template.steps.map(({ appKey }) => appKey ?? '').join(' ')
  const templateWords = words(
    `${template.name} ${template.description} ${appKeys}`,
  )
  let matches = 0
  for (const word of queryWords) {
    if (templateWords.has(word)) {
      matches += 1
    }
  }
  return matches
}

/**
 * Keeps every built-in template and the community templates that best match
 * the query by word overlap.
 *
 * Community templates come from every user, so this bounds the AI search
 * request as the collection grows.
 */
export function shortlistTemplates(
  query: string,
  templates: readonly ITemplate[],
): ITemplate[] {
  const queryWords = words(query)
  const builtIn = templates.filter(({ id }) => BUILT_IN_IDS.has(id))
  const community = templates
    .filter(({ id }) => !BUILT_IN_IDS.has(id))
    .map((template, index) => ({
      template,
      index,
      score: score(template, queryWords),
    }))
    // Ties keep the incoming order, which is newest first.
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, COMMUNITY_SEARCH_LIMIT)
    .map(({ template }) => template)
  return [...community, ...builtIn]
}

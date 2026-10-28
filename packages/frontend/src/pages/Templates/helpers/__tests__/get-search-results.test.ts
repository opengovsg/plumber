import { describe, expect, it } from 'vitest'

import { getSearchResults, type ListedTemplate } from '../get-search-results'

function makeTemplate(id: string): ListedTemplate {
  return { id, name: id, description: '', steps: [] }
}

const templates = [makeTemplate('a'), makeTemplate('b'), makeTemplate('c')]

describe('getSearchResults', () => {
  it('returns matched templates in ranked order', () => {
    const results = getSearchResults({
      matchedTemplateIds: ['c', 'a'],
      templates,
      limit: 5,
    })

    expect(results.map((template) => template.id)).toEqual(['c', 'a'])
  })

  it('drops matches the page does not list before applying the limit', () => {
    const results = getSearchResults({
      matchedTemplateIds: ['hidden', 'b', 'c'],
      templates,
      limit: 1,
    })

    expect(results.map((template) => template.id)).toEqual(['b'])
  })
})

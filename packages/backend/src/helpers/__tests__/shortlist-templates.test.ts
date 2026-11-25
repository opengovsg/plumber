import type { ITemplate } from '@plumber/types'
import { describe, expect, it } from 'vitest'

import { TEMPLATES } from '@/db/storage'

import {
  COMMUNITY_SEARCH_LIMIT,
  shortlistTemplates,
} from '../shortlist-templates'

function communityTemplate(
  index: number,
  name = `Template ${index}`,
): ITemplate {
  return {
    id: `community-${index}`,
    name,
    description: '',
    steps: [{ position: 1, appKey: 'formsg', eventKey: 'newSubmission' }],
  }
}

describe('shortlistTemplates', () => {
  const community = Array.from({ length: 100 }, (_, index) =>
    communityTemplate(index),
  )

  it('keeps every built-in template and at most 20 community templates', () => {
    const shortlist = shortlistTemplates('reminder', [
      ...community,
      ...TEMPLATES,
    ])

    const ids = shortlist.map(({ id }) => id)
    expect(ids.filter((id) => id.startsWith('community-'))).toHaveLength(
      COMMUNITY_SEARCH_LIMIT,
    )
    for (const { id } of TEMPLATES) {
      expect(ids).toContain(id)
    }
  })

  it('ranks community templates that share words with the query first', () => {
    const match = communityTemplate(100, 'Daily attendance reminder')

    const shortlist = shortlistTemplates('attendance reminder', [
      ...community,
      match,
    ])

    expect(shortlist[0].id).toBe(match.id)
  })

  it('keeps the newest community templates when nothing matches', () => {
    const shortlist = shortlistTemplates('payroll', community)

    expect(shortlist.map(({ id }) => id)).toEqual(
      community.slice(0, COMMUNITY_SEARCH_LIMIT).map(({ id }) => id),
    )
  })
})

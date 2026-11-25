import { describe, expect, it } from 'vitest'

import { replacePlaceholdersForHelpMessage } from '../flow-templates'

describe('replacePlaceholdersForHelpMessage', () => {
  it("links a Tiles step to its own table over the flow's tile", () => {
    const message = replacePlaceholdersForHelpMessage(
      'tiles_findSingleRow',
      { templateId: 't', tileId: 'first-tile' },
      'second-tile',
    )
    expect(message).toContain('/tiles/second-tile')
    expect(message).not.toContain('first-tile')
  })

  it("falls back to the flow's tile without a step table", () => {
    expect(
      replacePlaceholdersForHelpMessage('tiles_findSingleRow', {
        templateId: 't',
        tileId: 'first-tile',
      }),
    ).toContain('/tiles/first-tile')
  })

  it.each([
    ['tiles_createTileRow', 'a tile'],
    ['formsg_newSubmission', 'a form'],
  ])('hides the %s message without %s to link to', (appEventKey) => {
    expect(
      replacePlaceholdersForHelpMessage(appEventKey, { templateId: 't' }),
    ).toBe('')
  })

  it('keeps messages without placeholders', () => {
    expect(
      replacePlaceholdersForHelpMessage('postman_sendTransactionalEmail', {
        templateId: 't',
      }),
    ).toBe('Customise how your email looks like in this step.')
  })
})

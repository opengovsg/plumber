import { describe, expect, it } from 'vitest'

import { easeInOutCubic, getRevealScrollDelta } from './reveal-panel'

describe('easeInOutCubic', () => {
  it('starts at 0, ends at 1, and is symmetric around the midpoint', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBe(0.5)
  })

  it('starts slowly: the first quarter covers under 10% of the distance', () => {
    expect(easeInOutCubic(0.25)).toBeLessThan(0.1)
  })
})

describe('getRevealScrollDelta', () => {
  const base = {
    viewportTop: 0,
    viewportBottom: 600,
    inputTop: 300,
    panelBottom: 500,
  }

  it('does nothing when the panel already fits with its margin', () => {
    expect(getRevealScrollDelta(base)).toBe(0)
  })

  it('scrolls when the panel fits but sits closer than the margin', () => {
    expect(getRevealScrollDelta({ ...base, panelBottom: 580 })).toBe(28)
  })

  it('scrolls enough to show the whole panel plus the bottom margin', () => {
    expect(getRevealScrollDelta({ ...base, panelBottom: 700 })).toBe(148)
  })

  it('never pushes the input off the top of the viewport', () => {
    expect(
      getRevealScrollDelta({ ...base, inputTop: 100, panelBottom: 1000 }),
    ).toBe(84)
  })

  it('does not scroll when the input is already at the top edge', () => {
    expect(
      getRevealScrollDelta({ ...base, inputTop: 8, panelBottom: 1000 }),
    ).toBe(0)
  })
})

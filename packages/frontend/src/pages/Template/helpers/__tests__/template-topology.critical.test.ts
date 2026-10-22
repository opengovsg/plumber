// Business rule: update it so that the modal preview respects topology.
import type { ITemplateStep } from '@plumber/types'

import { describe, expect, it, vi } from 'vitest'

import { buildTemplatePreview } from '../template-topology'

const plain = (position: number): ITemplateStep => ({
  position,
  appKey: 'postman',
  eventKey: 'sendTransactionalEmail',
})
const block = (position: number, end: number): ITemplateStep => ({
  position,
  appKey: 'toolbox',
  eventKey: 'ifThen',
  config: { endStepId: `<<step_id_${end}>>` },
})

describe('template preview topology', () => {
  it('keeps steps after an explicit boundary outside the block', () => {
    const items = buildTemplatePreview([
      plain(1),
      block(2, 3),
      plain(3),
      plain(4),
    ])
    expect(items.map((item) => item.step.position)).toEqual([1, 2, 4])
    expect(items[1].children.map((item) => item.step.position)).toEqual([3])
  })

  it('preserves multiple disjoint blocks and sorts by position', () => {
    const items = buildTemplatePreview([
      plain(6),
      block(4, 5),
      plain(1),
      plain(3),
      block(2, 3),
      plain(5),
    ])
    expect(items.map((item) => item.step.position)).toEqual([1, 2, 4, 6])
    expect(items[1].children[0].step.position).toBe(3)
    expect(items[2].children[0].step.position).toBe(5)
  })

  it('preserves empty self-referencing blocks', () => {
    const items = buildTemplatePreview([plain(1), block(2, 2), plain(3)])
    expect(items[1].children).toEqual([])
    expect(items[2].step.position).toBe(3)
  })

  it('renders If and Only continue if inside Repeat', () => {
    const items = buildTemplatePreview([
      plain(1),
      { position: 2, appKey: 'toolbox', eventKey: 'forEach' },
      block(3, 5),
      { position: 4, appKey: 'toolbox', eventKey: 'onlyContinueIf' },
      plain(5),
      plain(6),
    ])
    const repeat = items[1]
    expect(repeat.type).toBe('forEachBlock')
    expect(repeat.children.map((item) => item.step.position)).toEqual([3, 6])
    expect(
      repeat.children[0].children.map((item) => item.step.position),
    ).toEqual([4, 5])
  })

  it('renders Repeat inside an explicit If without swallowing following steps', () => {
    const items = buildTemplatePreview([
      plain(1),
      block(2, 4),
      { position: 3, appKey: 'toolbox', eventKey: 'forEach' },
      plain(4),
      plain(5),
    ])
    expect(items.map((item) => item.step.position)).toEqual([1, 2, 5])
    expect(items[1].children[0].type).toBe('forEachBlock')
    expect(items[1].children[0].children[0].step.position).toBe(4)
  })

  it('separates an MRF rejection block from the normal sequence', () => {
    const approval = { branch: 'reject' as const, stepId: '<<step_id_2>>' }
    const items = buildTemplatePreview([
      plain(1),
      { position: 2, appKey: 'formsg', eventKey: 'mrfSubmission' },
      { ...block(3, 4), config: { approval, endStepId: '<<step_id_4>>' } },
      { ...plain(4), config: { approval } },
      plain(5),
    ])
    expect(items.map((item) => item.step.position)).toEqual([1, 2, 5])
    const branch = items[1].rejectionChildren
    expect(branch[0].type).toBe('ifThenBlock')
    expect(branch[0].children[0].step.position).toBe(4)
  })

  it('preserves legacy branch depths when config is absent', () => {
    const legacy = (position: number, depth: number): ITemplateStep => ({
      position,
      appKey: 'toolbox',
      eventKey: 'ifThen',
      parameters: { depth },
    })
    const items = buildTemplatePreview([
      plain(1),
      legacy(2, 0),
      legacy(3, 1),
      plain(4),
      legacy(5, 0),
      plain(6),
    ])
    expect(items.map((item) => item.step.position)).toEqual([1, 2, 5])
    expect(items[1].children[0].step.position).toBe(3)
    expect(items[1].children[0].children[0].step.position).toBe(4)
    expect(items[2].children[0].step.position).toBe(6)
  })

  it('clamps a legacy branch to its MRF region', () => {
    const items = buildTemplatePreview([
      plain(1),
      {
        position: 2,
        appKey: 'toolbox',
        eventKey: 'ifThen',
        parameters: { depth: 0 },
      },
      plain(3),
      { position: 4, appKey: 'formsg', eventKey: 'mrfSubmission' },
      plain(5),
    ])
    expect(items.map((item) => item.step.position)).toEqual([1, 2, 4, 5])
    expect(items[1].children[0].step.position).toBe(3)
  })

  it('flags dangling markers without mutating template data', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const steps = [plain(1), block(2, 99), plain(3)]
      const before = structuredClone(steps)
      expect(buildTemplatePreview(steps)[1].isDangling).toBe(true)
      expect(steps).toEqual(before)
    } finally {
      warn.mockRestore()
    }
  })
})

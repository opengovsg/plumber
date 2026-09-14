import type { IField } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import { shouldHideEmptySourceDropdown } from '../isFieldHidden'

const sourceDropdown = {
  key: 'attachmentField',
  type: 'dropdown',
  hideWhenNoOptions: true,
  source: {
    type: 'query',
    name: 'getDynamicData',
    arguments: [{ name: 'key', value: 'getCaseAttachmentFields' }],
  },
} as unknown as IField

describe('shouldHideEmptySourceDropdown', () => {
  it('hides when configured, source-backed, done loading, and no options', () => {
    expect(shouldHideEmptySourceDropdown(sourceDropdown, [], false)).toBe(true)
  })

  it('hides while still loading, to avoid a flash before it disappears', () => {
    expect(shouldHideEmptySourceDropdown(sourceDropdown, [], true)).toBe(true)
  })

  it('does not hide when there are options', () => {
    expect(
      shouldHideEmptySourceDropdown(
        sourceDropdown,
        [{ label: 'a', value: 'a' }],
        false,
      ),
    ).toBe(false)
  })

  it('does not hide when hideWhenNoOptions is not set', () => {
    const field = { ...sourceDropdown, hideWhenNoOptions: false } as IField
    expect(shouldHideEmptySourceDropdown(field, [], false)).toBe(false)
  })

  it('does not hide a dropdown without a source', () => {
    const field = {
      key: 'x',
      type: 'dropdown',
      hideWhenNoOptions: true,
    } as unknown as IField
    expect(shouldHideEmptySourceDropdown(field, [], false)).toBe(false)
  })

  it('does not apply to non-dropdown fields', () => {
    const field = {
      key: 'x',
      type: 'string',
      hideWhenNoOptions: true,
    } as unknown as IField
    expect(shouldHideEmptySourceDropdown(field, [], false)).toBe(false)
  })
})

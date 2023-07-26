import { describe, expect, it } from 'vitest'

import { escapeMarkdown, sanitizeMarkdown } from '../../common/markdown-v1'

describe('telegram markdown handler', () => {
  describe('escapeMarkdown', () => {
    it('should escape special characters for markdownv1', () => {
      expect(escapeMarkdown('_')).toEqual('\\_')
      expect(escapeMarkdown('mew_mew_mew@mine.com')).toEqual(
        'mew\\_mew\\_mew@mine.com',
      )
      expect(escapeMarkdown('_*_')).toEqual('\\_\\*\\_')
      expect(escapeMarkdown('_hello`[sir_')).toEqual('\\_hello\\`\\[sir\\_')
    })
  })

  describe('sanitizeMarkdown', () => {
    it('should allow for matching special characters', () => {
      expect(sanitizeMarkdown('*hello*')).toEqual('*hello*')
      expect(sanitizeMarkdown('_hello_')).toEqual('_hello_')
      expect(sanitizeMarkdown('`hello` *hello* _hello_')).toEqual(
        '`hello` *hello* _hello_',
      )
    })

    it('should escape special characters if they are between special characters', () => {
      expect(sanitizeMarkdown('*hello_world*')).toEqual('\\*hello\\_world\\*')
    })

    it('should escape special characters if they are between special characters', () => {
      expect(sanitizeMarkdown('*hello_world*')).toEqual('\\*hello\\_world\\*')
    })

    it('should escape unmatched special characters', () => {
      expect(sanitizeMarkdown('_')).toEqual('\\_')
      expect(sanitizeMarkdown('```')).toEqual('``\\`')
      expect(sanitizeMarkdown('*hello*_')).toEqual('*hello*\\_')
      expect(sanitizeMarkdown('*hello**')).toEqual('*hello*\\*')
    })

    it('should unescape special characters between matching special characters', () => {
      expect(sanitizeMarkdown('*hello\\_you@example.com*')).toEqual(
        '*hello_you@example.com*',
      )
      expect(sanitizeMarkdown('*he\\`llo\\_you@example.com*')).toEqual(
        '*he`llo_you@example.com*',
      )
    })

    it('should escape all matching special characters if there are escaped matching characters between them', () => {
      expect(sanitizeMarkdown('*hello\\*world*')).toEqual('\\*hello\\*world\\*')
      expect(sanitizeMarkdown('*hel\\_lo\\*world*')).toEqual(
        '\\*hel\\_lo\\*world\\*',
      )
    })
  })
})

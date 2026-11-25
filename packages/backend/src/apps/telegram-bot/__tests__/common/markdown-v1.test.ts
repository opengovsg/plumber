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
      expect(escapeMarkdown('_wee*loong\\_loong@open.gov.sg')).toEqual(
        '\\_wee\\*loong\\\\_loong@open.gov.sg',
      )
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

    it('should not treat escape special characters as modifiers', () => {
      expect(sanitizeMarkdown('hello\\_you@gmail.com')).toEqual(
        'hello\\_you@gmail.com',
      )
      expect(sanitizeMarkdown('_wee*loong\\_loong@open.gov.sg')).toEqual(
        '\\_wee\\*loong\\_loong@open.gov.sg',
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

    it('should escape a modifier replaced by a different modifier without dropping characters', () => {
      expect(sanitizeMarkdown('*hello\\_world_ok')).toEqual(
        '\\*hello\\_world\\_ok',
      )
      expect(sanitizeMarkdown('*a\\_b_c_')).toEqual('\\*a\\_b_c_')
    })

    // Guards against the quadratic rebuild that blocked the event loop.
    it.each([
      {
        pattern: 'alternating unescaped modifiers',
        text: '_*'.repeat(250_000),
        expected: '\\_\\*'.repeat(250_000),
      },
      {
        pattern: 'escaped modifiers inside an open modifier',
        text: '*' + '\\_'.repeat(250_000) + '*',
        expected: '*' + '_'.repeat(250_000) + '*',
      },
      {
        pattern: 'escaped modifiers inside an unclosed modifier',
        text: '*' + '\\_'.repeat(250_000),
        expected: '\\*' + '\\_'.repeat(250_000),
      },
    ])(
      'should sanitize 500k characters of $pattern quickly',
      ({ text, expected }) => {
        const start = performance.now()
        const sanitized = sanitizeMarkdown(text)
        expect(performance.now() - start).toBeLessThan(500)
        expect(sanitized).toEqual(expected)
      },
    )
  })
})

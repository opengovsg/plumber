import { describe, expect, it } from 'vitest'

import { buildSystemPrompt } from './build-system-prompt'

describe('buildSystemPrompt - Robustness Tests', () => {
  it('should handle tables with varied spacing around app keys', () => {
    const prompt = `## Available Actions

| App | Display Name | Events |
|---|---|---|
|\`m365-excel\`|M365 Excel|\`createTableRow\`|
| \`calculator\` | Calculator | \`add\` |
|  \`tiles\`  |  Tiles  |  \`create\`  |`

    const result = buildSystemPrompt(prompt, ['m365-excel'])

    // Should remove the table row for m365-excel
    expect(result).not.toContain('`m365-excel`')
    expect(result).not.toContain('M365 Excel')

    // Should keep other apps
    expect(result).toContain('`calculator`')
    expect(result).toContain('`tiles`')

    // Should have the safety note
    expect(result).toContain(
      'Note: this user does not have access to the following apps: m365-excel',
    )
  })

  it('should handle tables with no spaces around pipes', () => {
    const prompt = `|App|Display Name|Events|
|---|---|---|
|\`m365-excel\`|M365 Excel|\`createTableRow\`|
|\`calculator\`|Calculator|\`add\`|`

    const result = buildSystemPrompt(prompt, ['m365-excel'])

    expect(result).not.toContain('`m365-excel`')
    expect(result).not.toContain('M365 Excel')
    expect(result).toContain('`calculator`')
  })

  it('should handle tables with extra whitespace', () => {
    const prompt = `|  App  |  Display Name  |  Events  |
|---|---|---|
|  \`m365-excel\`  |  M365 Excel  |  \`createTableRow\`  |
|  \`calculator\`  |  Calculator  |  \`add\`  |`

    const result = buildSystemPrompt(prompt, ['m365-excel'])

    expect(result).not.toContain('`m365-excel`')
    expect(result).not.toContain('M365 Excel')
    expect(result).toContain('`calculator`')
  })

  it('should handle alias tables with different column counts', () => {
    const prompt = `| User says | Maps to app | If restricted | Priority |
|---|---|---|---|
| "excel" | M365 Excel | Tiles | High |
| "calc" | Calculator | N/A | Low |`

    const result = buildSystemPrompt(prompt, ['m365-excel'])

    // Should remove the alias row for excel
    expect(result).not.toContain('"excel"')
    expect(result).not.toContain('M365 Excel')

    // Should keep calculator alias
    expect(result).toContain('"calc"')
  })

  it('should handle alias tables with fewer columns', () => {
    const prompt = `| User says | Maps to app |
|---|---|
| "excel" | M365 Excel |
| "calc" | Calculator |`

    const result = buildSystemPrompt(prompt, ['m365-excel'])

    expect(result).not.toContain('"excel"')
    expect(result).not.toContain('M365 Excel')
    expect(result).toContain('"calc"')
  })

  it('should handle logic rules with varied indentation', () => {
    const prompt = `## Logic Rules

- M365 Excel: Use updateTableRow
  - Tiles: Use updateRecord for storage
    - Calculator: Use for math`

    const result = buildSystemPrompt(prompt, ['m365-excel', 'tiles'])

    expect(result).not.toContain('M365 Excel: Use updateTableRow')
    expect(result).not.toContain('Tiles: Use updateRecord')
    expect(result).toContain('Calculator: Use for math')
  })

  it('should handle logic rules with bullet points (*)', () => {
    const prompt = `## Logic Rules

* M365 Excel: Use updateTableRow
* Tiles: Use updateRecord
* Calculator: Use for math`

    const result = buildSystemPrompt(prompt, ['m365-excel'])

    expect(result).not.toContain('M365 Excel: Use updateTableRow')
    expect(result).toContain('Tiles: Use updateRecord')
  })

  it('should handle case-insensitive app name matching in tables', () => {
    const prompt = `| User says | Maps to app |
|---|---|
| "excel" | m365 excel |
| "calc" | calculator |`

    const result = buildSystemPrompt(prompt, ['m365-excel'])

    // Should remove the excel alias row (case-insensitive match)
    expect(result).not.toContain('"excel"')
    expect(result).not.toContain('m365 excel')

    expect(result).toContain('"calc"')
  })

  it('should handle modified table headers without breaking', () => {
    // Changed header from "App | Display Name" to "Application | Name"
    const prompt = `| Application | Name | Events |
|---|---|---|
| \`m365-excel\` | M365 Excel | \`createTableRow\` |
| \`calculator\` | Calculator | \`add\` |`

    const result = buildSystemPrompt(prompt, ['m365-excel'])

    expect(result).not.toContain('`m365-excel`')
    expect(result).not.toContain('M365 Excel')
    expect(result).toContain('`calculator`')
  })

  it('should handle apps with special regex characters in names', () => {
    // Test that regex escaping works for app keys with special chars
    const prompt = `| App | Display Name |
|---|---|
| \`custom-api\` | Custom API |
| \`postman-sms\` | SMS by Postman |`

    const result = buildSystemPrompt(prompt, ['custom-api'])

    expect(result).not.toContain('`custom-api`')
    expect(result).not.toContain('Custom API')
    expect(result).toContain('`postman-sms`')
  })

  it('should handle empty lines and extra newlines gracefully', () => {
    const prompt = `## Available Actions


| App | Display Name |

|---|---|

| \`m365-excel\` | M365 Excel |

| \`calculator\` | Calculator |

`

    const result = buildSystemPrompt(prompt, ['m365-excel'])

    expect(result).not.toContain('`m365-excel`')
    expect(result).not.toContain('M365 Excel')
    expect(result).toContain('`calculator`')
  })

  it('should still append safety note when no apps found in prompt', () => {
    const prompt = `# Simple Prompt

No tables here.`

    const result = buildSystemPrompt(prompt, ['m365-excel', 'unknown-app'])

    // Should append the safety note even if no tables were found
    expect(result).toContain(
      'Note: this user does not have access to the following apps: m365-excel, unknown-app',
    )
  })

  it('should handle app key appearing in non-table context without removing', () => {
    const prompt = `# System Prompt

When using m365-excel, always validate first.

| App | Display Name |
|---|---|
| \`m365-excel\` | M365 Excel |
| \`calculator\` | Calculator |`

    const result = buildSystemPrompt(prompt, ['m365-excel'])

    // Should remove the table row but keep the mention in prose
    expect(result).toContain('When using m365-excel, always validate first')
    expect(result).not.toContain('`m365-excel`')
    expect(result).not.toContain('M365 Excel')
    expect(result).toContain('`calculator`')
  })

  it('should handle display name with special characters', () => {
    const prompt = `| App | Display Name |
|---|---|
| \`postman-sms\` | SMS by Postman |
| \`calculator\` | Calculator |`

    const result = buildSystemPrompt(prompt, ['postman-sms'])

    expect(result).not.toContain('`postman-sms`')
    expect(result).not.toContain('SMS by Postman')
    expect(result).toContain('`calculator`')
  })

  it('should return unchanged prompt when restrictedApps is empty', () => {
    const prompt = `## Available Actions

| App | Display Name |
|---|---|
| \`m365-excel\` | M365 Excel |
| \`calculator\` | Calculator |`

    const result = buildSystemPrompt(prompt, [])

    // Should return the exact same prompt (no safety note, no stripping)
    expect(result).toBe(prompt)
  })
})

/**
 * Builds a system prompt with restricted apps removed
 *
 * Strips restricted apps from:
 * 1. Table rows (Available Actions, Available Triggers, User Context aliases)
 * 2. Logic rule bullets (e.g., "- M365 Excel: Use updateTableRow")
 *
 * This implementation:
 * - Uses regex for flexible whitespace matching
 * - Tolerates extra/missing spaces in tables
 * - Works with varied indentation
 * - Pre-compiles patterns for efficiency
 *
 * Also appends a safety net note listing the restricted apps.
 */

const APP_DISPLAY_NAMES: Record<string, string> = {
  formsg: 'FormSG',
  webhook: 'Webhook',
  scheduler: 'Scheduler',
  gathersg: 'GatherSG',
  calculator: 'Calculator',
  'custom-api': 'Custom API',
  delay: 'Delay',
  formatter: 'Formatter',
  lettersg: 'LetterSG',
  'm365-excel': 'M365 Excel',
  paysg: 'PaySG',
  postman: 'Email by Postman',
  'postman-sms': 'SMS by Postman',
  slack: 'Slack',
  'telegram-bot': 'Telegram',
  tiles: 'Tiles',
  toolbox: 'Toolbox',
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Builds a system prompt with restricted apps removed
 *
 * @param basePrompt - The original system prompt (markdown)
 * @param restrictedApps - Array of app keys that the user does not have access to
 * @returns The modified prompt with restricted apps stripped and a safety net note appended
 */
export function buildSystemPrompt(
  basePrompt: string,
  restrictedApps: string[],
): string {
  if (restrictedApps.length === 0) {
    return basePrompt
  }

  // Pre-compile regex patterns once (efficiency)
  const patterns = restrictedApps.map((appKey) => {
    const displayName = APP_DISPLAY_NAMES[appKey] || appKey
    return {
      appKey,
      displayName,
      // Match app key in backticks: `m365-excel`
      backticks: new RegExp(`\\\`${escapeRegex(appKey)}\\\``),
      // Match display name in table cell: | M365 Excel | (flexible spacing)
      tableCell: new RegExp(`\\|[^|]*${escapeRegex(displayName)}[^|]*\\|`, 'i'),
      // Match logic rule bullet: - M365 Excel: or * M365 Excel:
      logicRule: new RegExp(
        `^\\s*[-*]\\s*${escapeRegex(displayName)}\\s*:`,
        'i',
      ),
    }
  })

  const lines = basePrompt.split('\n')
  const filteredLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip separator rows (always keep)
    if (trimmed.includes('---')) {
      filteredLines.push(line)
      continue
    }

    // Check if this is a table row
    const isTableRow = /^\|.*\|$/.test(trimmed)

    // Check if line should be removed
    let shouldRemove = false

    for (const p of patterns) {
      if (isTableRow) {
        // For table rows: check for app key in backticks OR display name
        if (p.backticks.test(line) || p.tableCell.test(line)) {
          // Don't remove if it's a header row
          const hasHeaderKeywords =
            line.includes('App') ||
            line.includes('Display Name') ||
            line.includes('User says') ||
            line.includes('Maps to')

          if (!hasHeaderKeywords) {
            shouldRemove = true
            break
          }
        }
      } else {
        // For non-table lines: check for logic rule bullets
        if (p.logicRule.test(line)) {
          shouldRemove = true
          break
        }
      }
    }

    if (!shouldRemove) {
      filteredLines.push(line)
    }
  }

  // Append safety note
  const safetyNote = `\n\nNote: this user does not have access to the following apps: ${restrictedApps.join(
    ', ',
  )}.`
  return filteredLines.join('\n') + safetyNote
}

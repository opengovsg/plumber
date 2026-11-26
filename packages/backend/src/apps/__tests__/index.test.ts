import fs from 'fs'
import { join } from 'path'

import { describe, expect, it } from 'vitest'

import exportedApps from '@/apps'
import { ACTION_APPS_RANKING, TRIGGER_APPS_RANKING } from '@/apps/app-rankings'

describe('index.ts', () => {
  it('should export all apps keys that also match their folder names', () => {
    const exportedAppNames = Object.keys(exportedApps)

    // Dynamic apps
    const folderPath = join(__dirname, '..')

    const appFolderNames = fs
      .readdirSync(folderPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && dirent.name !== '__tests__')
      .map((dirent) => dirent.name)
    // Set comparison
    expect(exportedAppNames.length).toEqual(appFolderNames.length)
    expect(exportedAppNames.sort()).toEqual(appFolderNames.sort())
  })
})

describe('get-apps query', () => {
  it('number of apps in ranking maps should match with the number of apps we have', () => {
    const exportedAppNamesSet = new Set(Object.keys(exportedApps))
    const rankingMapAppsSet = new Set([
      ...TRIGGER_APPS_RANKING,
      ...ACTION_APPS_RANKING,
    ])
    expect(exportedAppNamesSet).toEqual(rankingMapAppsSet)
  })
})

describe('action catalog', () => {
  const catalogPath = join(
    __dirname,
    '../../../../backend-analytics/data/action-catalog.csv',
  )
  const header = [
    'app_key',
    'action_key',
    'name',
    'is_trigger',
    'is_active',
    'resource_parameter',
    'launched_at',
  ] as const

  type CatalogRow = Record<(typeof header)[number], string>

  // Splits one line of RFC 4180 CSV. Names may hold commas and quotes, but never newlines.
  function splitCsvLine(line: string): string[] {
    const cells: string[] = []
    let cell = ''
    let quoted = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (quoted && ch === '"' && line[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        quoted = !quoted
      } else if (ch === ',' && !quoted) {
        cells.push(cell)
        cell = ''
      } else {
        cell += ch
      }
    }
    return [...cells, cell]
  }

  const toCsvCell = (value: string) =>
    /[",]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value

  const catalogKey = (row: CatalogRow) => `${row.app_key}.${row.action_key}`

  // Analytics cannot import the apps registry, so it reads this file. Launch dates are typed by hand.
  // Removed app-actions stay as inactive, because past steps and executions still name them.
  function readCommitted(): Map<string, CatalogRow> {
    const committed = new Map<string, CatalogRow>()
    if (!fs.existsSync(catalogPath)) {
      return committed
    }
    const [, ...lines] = fs
      .readFileSync(catalogPath, 'utf8')
      .split('\n')
      .filter(Boolean)
    for (const line of lines) {
      const cells = splitCsvLine(line)
      const row = Object.fromEntries(
        header.map((name, i) => [name, cells[i] ?? '']),
      ) as CatalogRow
      committed.set(catalogKey(row), row)
    }
    return committed
  }

  it('matches the analytics catalog file', async () => {
    const committed = readCommitted()

    const active: CatalogRow[] = Object.values(exportedApps).flatMap((app) =>
      [
        ...(app.triggers ?? []).map((event) => ({ event, isTrigger: true })),
        ...(app.actions ?? []).map((event) => ({ event, isTrigger: false })),
      ].map(({ event, isTrigger }) => ({
        app_key: app.key,
        action_key: event.key,
        name: event.name,
        is_trigger: String(isTrigger),
        is_active: 'true',
        resource_parameter:
          committed.get(`${app.key}.${event.key}`)?.resource_parameter ?? '',
        launched_at:
          committed.get(`${app.key}.${event.key}`)?.launched_at ?? '',
      })),
    )
    const activeKeys = new Set(active.map(catalogKey))
    const retired = [...committed.values()]
      .filter((row) => !activeKeys.has(catalogKey(row)))
      .map((row) => ({ ...row, is_active: 'false' }))
    const rows = [...active, ...retired].sort((a, b) =>
      catalogKey(a).localeCompare(catalogKey(b)),
    )
    const csv = [header, ...rows.map((row) => header.map((name) => row[name]))]
      .map((cells) => cells.map(toCsvCell).join(','))
      .join('\n')

    await expect(
      `${csv}\n`,
      'action-catalog.csv is stale. Run `pnpm --filter backend exec vitest run src/apps/__tests__/index.test.ts -u` and commit the file.',
    ).toMatchFileSnapshot(catalogPath)
  })
  // flow_step reads each step's resource from this argument. A blank cell is an undecided new app-action.
  it('names a real argument as each active resource parameter', () => {
    const argumentKeys = new Map(
      Object.values(exportedApps).flatMap((app) =>
        [...(app.triggers ?? []), ...(app.actions ?? [])].map((event) => [
          `${app.key}.${event.key}`,
          new Set(
            // The registry holds raw actions, whose fields sit on `arguments`, not `substeps`.
            ((event as { arguments?: { key: string }[] }).arguments ?? []).map(
              (argument) => argument.key,
            ),
          ),
        ]),
      ),
    )
    const invalid = [...readCommitted().values()]
      .filter((row) => row.is_active === 'true')
      .filter(
        (row) =>
          row.resource_parameter !== 'none' &&
          !argumentKeys.get(catalogKey(row))?.has(row.resource_parameter),
      )
      .map((row) => `${catalogKey(row)}: '${row.resource_parameter}'`)

    expect(
      invalid,
      'Set resource_parameter in action-catalog.csv to the argument key that names the table, file, channel or other resource the step points at, or to none.',
    ).toEqual([])
  })
})

describe('sendsToRecipientsOnTest', () => {
  // AI Builder refuses to test these steps without confirmation, so a new sending action must opt in deliberately.
  it('is set on exactly the actions whose test run messages real recipients', () => {
    const flagged = Object.values(exportedApps)
      .flatMap((app) =>
        (app.actions ?? [])
          .filter((action) => action.sendsToRecipientsOnTest === true)
          .map((action) => `${app.key}.${action.key}`),
      )
      .sort()

    expect(flagged).toEqual([
      'paysg.sendEmail',
      'postman-sms.sendSms',
      'slack.sendMessageToChannel',
      'telegram-bot.sendMessage',
      'twilio.sendSms',
    ])
  })
})

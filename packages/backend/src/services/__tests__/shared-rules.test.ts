import { existsSync, readdirSync, readFileSync } from 'fs'
import path from 'path'

import { describe, expect, it } from 'vitest'

type SharedRule =
  | {
      kind: 'only-in'
      pattern: RegExp
      use: string
      allowed: Record<string, string>
    }
  | {
      kind: 'never-in'
      pattern: RegExp
      use: string
      files: string[]
    }

const SRC_DIR = path.resolve(__dirname, '../..')
const SCANNED_DIRS = ['services', 'graphql']
const SKIPPED_DIRS = new Set(['__generated__', '__tests__'])

const RULES: SharedRule[] = [
  {
    kind: 'only-in',
    pattern: /hiddenFromUser/,
    use: 'lookupStepDefinition or isUserVisible from services/step-definition.ts',
    allowed: {
      'services/step-definition.ts': 'owner',
    },
  },
  {
    kind: 'only-in',
    pattern: /transformStepParameters\(/,
    use: 'prepareStepParameters from services/step-parameters.ts',
    allowed: {
      'services/step-parameters.ts': 'owner',
    },
  },
  {
    kind: 'never-in',
    pattern: /connections\.user_id/,
    use: 'getConnection from services/connection.ts',
    files: [
      'graphql/mutations/create-step.ts',
      'graphql/mutations/update-step.ts',
      'services/mcp/update-step-parameters.ts',
    ],
  },
  {
    kind: 'only-in',
    pattern: /registerConnection\?\.\(/,
    use: 'registerConnectionForFlow from services/connection-registration.ts',
    allowed: {
      'services/connection-registration.ts': 'owner',
    },
  },
  {
    kind: 'only-in',
    pattern: /connection\.userId !== null/,
    use: 'isForeignPersonalConnection from services/connection.ts',
    allowed: {
      'services/connection.ts': 'owner',
    },
  },
  {
    kind: 'never-in',
    pattern: /withAccessibleFlows\(|withAccessibleSteps\(/,
    use: 'loadAccessibleFlow or loadAccessibleStep from services/access.ts',
    files: [
      'graphql/mutations/register-connection.ts',
      'services/mcp/register-connection.ts',
    ],
  },
]

function listSourceFiles(dir: string): string[] {
  return readdirSync(path.join(SRC_DIR, dir), { withFileTypes: true }).flatMap(
    (entry) => {
      const relative = path.posix.join(dir, entry.name)
      if (entry.isDirectory()) {
        return SKIPPED_DIRS.has(entry.name) ? [] : listSourceFiles(relative)
      }
      return /(?<!\.d|\.test|\.itest)\.ts$/.test(entry.name) ? [relative] : []
    },
  )
}

const sources = new Map(
  SCANNED_DIRS.flatMap(listSourceFiles).map((file) => [
    file,
    readFileSync(path.join(SRC_DIR, file), 'utf8').split('\n'),
  ]),
)

function covers(entry: string, file: string): boolean {
  return entry.endsWith('/') ? file.startsWith(entry) : file === entry
}

function findHits(pattern: RegExp, files: string[]): string[] {
  return files.flatMap((file) =>
    sources
      .get(file)
      .flatMap((line, index) =>
        pattern.test(line) ? [`${file}:${index + 1}`] : [],
      ),
  )
}

function ruleEntries(rule: SharedRule): string[] {
  return rule.kind === 'only-in' ? Object.keys(rule.allowed) : rule.files
}

function findViolations(rule: SharedRule): string[] {
  const entries = ruleEntries(rule)
  const missing = entries
    .filter((entry) => !existsSync(path.join(SRC_DIR, entry)))
    .map((entry) => `${entry} is listed in the rule but does not exist`)

  const isListed = (file: string) =>
    entries.some((entry) => covers(entry, file))
  const checked = [...sources.keys()].filter((file) =>
    rule.kind === 'only-in' ? !isListed(file) : isListed(file),
  )
  const hits = findHits(rule.pattern, checked).map(
    (hit) => `${hit} matches ${rule.pattern}. Use ${rule.use} instead.`,
  )

  const stale =
    rule.kind === 'only-in'
      ? entries
          .filter(
            (entry) =>
              sources.has(entry) &&
              findHits(rule.pattern, [entry]).length === 0,
          )
          .map(
            (entry) =>
              `${entry} no longer matches ${rule.pattern}. Remove it from the rule.`,
          )
      : []

  return [...missing, ...hits, ...stale]
}

describe('shared rules', () => {
  it.each(RULES.map((rule) => [String(rule.pattern), rule] as const))(
    '%s stays in its shared owner',
    (_name, rule) => {
      expect(findViolations(rule)).toEqual([])
    },
  )
})

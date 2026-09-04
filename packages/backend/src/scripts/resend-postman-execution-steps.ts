/* eslint-disable no-console */
import '@/config/app-env-vars'
import '@/config/orm'

import { readFileSync } from 'fs'
import { z } from 'zod'

import { client as db } from '@/config/database'
import {
  ResendPostmanStepError,
  resendPostmanExecutionStepById,
} from '@/services/resend-postman-execution-step'

const uuidSchema = z.string().uuid()

function printUsage(): void {
  console.error(`Usage:
  npx ts-node --swc src/scripts/resend-postman-execution-steps.ts --ids <uuid>[,<uuid>...]
  npx ts-node --swc src/scripts/resend-postman-execution-steps.ts --file <path>

Options:
  --dry-run          Load rows and print recipients. Do not send.
  --max-attempts N   Retries for RetriableError. Default 5.
  --delay-ms N       Pause between execution steps. Default 50.

Reads stored execution_steps.data_in and resends that Postman email.
Does not expose a user-facing retry. Does not write a new execution_step.
`)
}

function parseIdsFromText(raw: string): string[] {
  const tokens = raw
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !token.startsWith('#'))

  const ids: string[] = []
  const seen = new Set<string>()
  for (const token of tokens) {
    const parsed = uuidSchema.safeParse(token)
    if (!parsed.success) {
      throw new Error(`Invalid execution step id: ${token}`)
    }
    if (seen.has(parsed.data)) {
      continue
    }
    seen.add(parsed.data)
    ids.push(parsed.data)
  }
  return ids
}

function parseArgs(argv: string[]): {
  ids: string[]
  dryRun: boolean
  maxAttempts: number | undefined
  delayMs: number
} {
  const get = (flag: string) => {
    const idx = argv.indexOf(flag)
    return idx !== -1 ? argv[idx + 1] : undefined
  }

  const dryRun = argv.includes('--dry-run')
  const idsArg = get('--ids')
  const fileArg = get('--file')
  const maxAttemptsArg = get('--max-attempts')
  const delayMsArg = get('--delay-ms')

  if (!idsArg && !fileArg) {
    printUsage()
    process.exit(1)
  }

  const raw = fileArg ? readFileSync(fileArg, 'utf8') : (idsArg ?? '')
  const ids = parseIdsFromText(raw)
  if (ids.length === 0) {
    throw new Error('No execution step ids provided')
  }

  return {
    ids,
    dryRun,
    maxAttempts: maxAttemptsArg ? Number(maxAttemptsArg) : undefined,
    delayMs: delayMsArg ? Number(delayMsArg) : 50,
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function main(): Promise<void> {
  const { ids, dryRun, maxAttempts, delayMs } = parseArgs(process.argv.slice(2))

  console.log(
    JSON.stringify({
      count: ids.length,
      dryRun,
      maxAttempts: maxAttempts ?? 5,
    }),
  )

  let failed = 0
  for (let i = 0; i < ids.length; i++) {
    const executionStepId = ids[i]
    try {
      const result = await resendPostmanExecutionStepById(executionStepId, {
        dryRun,
        maxAttempts,
      })
      if (result.error) {
        failed += 1
      }
      console.log(JSON.stringify(result))
    } catch (error) {
      failed += 1
      const message =
        error instanceof ResendPostmanStepError || error instanceof Error
          ? error.message
          : String(error)
      console.log(
        JSON.stringify({
          executionStepId,
          error: message,
        }),
      )
    }

    if (i < ids.length - 1 && delayMs > 0) {
      await sleep(delayMs)
    }
  }

  if (failed > 0) {
    process.exitCode = 1
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.destroy()
  })

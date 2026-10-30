import appConfig from '@/config/app'
import { safeHtml, trustedHtml } from '@/helpers/html-utils'
import logger from '@/helpers/logger'
import { sendEmail } from '@/helpers/send-email'

export const REPORT_RECIPIENT = 'plumber@open.gov.sg'
const NOTEBOOK_URL = 'https://ogp.datadoghq.com/notebook/16141862'

export interface RunReport {
  migrated: number
  skipped: number
  aborted: number
  failed: number
  remaining: number
  failedTableIds: string[]
  abortedTableIds: string[]
}

function idList(ids: string[]): { __html: string; __trusted: boolean } {
  return trustedHtml(ids.map((id) => safeHtml`<li>${id}</li>`).join(''))
}

export function buildReportEmail(report: RunReport): {
  subject: string
  body: string
} {
  const env = appConfig.appEnv
  const done = report.remaining === 0
  const subject = done
    ? `Plumber (${env}): tiles migration complete`
    : `Plumber (${env}): tiles migration run, ${report.migrated} migrated, ${report.remaining} left`

  const body = safeHtml`
    <p>${
      done
        ? 'No DynamoDB tiles are left to migrate. Set the tiles-ddb-migration flag to off and remove the nightly tiles-migration worker.'
        : 'The nightly tiles migration run finished.'
    }</p>
    <ul>
      <li>Migrated: ${String(report.migrated)}</li>
      <li>Skipped: ${String(report.skipped)}</li>
      <li>Aborted: ${String(report.aborted)}</li>
      <li>Failed: ${String(report.failed)}</li>
      <li>Remaining: ${String(report.remaining)}</li>
    </ul>
    ${
      report.failedTableIds.length
        ? trustedHtml(
            safeHtml`<p>Failed tiles:</p><ul>${idList(
              report.failedTableIds,
            )}</ul>`,
          )
        : ''
    }
    ${
      report.abortedTableIds.length
        ? trustedHtml(
            safeHtml`<p>Aborted tiles:</p><ul>${idList(
              report.abortedTableIds,
            )}</ul>`,
          )
        : ''
    }
    <p>Errors and per-tile details: <a href="${NOTEBOOK_URL}">${NOTEBOOK_URL}</a></p>
  `
  return { subject, body }
}

/** A failed email must not fail the run, since the migration work is already done. */
export async function sendReportEmail(report: RunReport): Promise<void> {
  // Local runs would otherwise email the team on every test.
  if (appConfig.isDev) {
    return
  }
  try {
    await sendEmail({
      ...buildReportEmail(report),
      recipient: REPORT_RECIPIENT,
    })
  } catch (err) {
    logger.error('tiles-migration.report-email.failed', {
      err: (err as Error).message,
    })
  }
}

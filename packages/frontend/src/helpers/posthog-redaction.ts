import type { CaptureResult, Properties } from 'posthog-js'

// Matches both raw and URL-encoded (`%40`) emails.
const EMAIL_PATTERN =
  /[A-Za-z0-9._+-]+(?:@|%40)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/gi

// Catches $current_url, $pathname, $referrer and their $initial_ /
// $session_entry_ variants.
const URL_PROPERTY_PATTERN = /(url|pathname|referrer)$/i

export const REDACTED_EMAIL = '[redacted-email]'

export function redactEmails(value: string): string {
  return value.replace(EMAIL_PATTERN, REDACTED_EMAIL)
}

function redactUrlProperties(properties: Properties | undefined): void {
  if (!properties) {
    return
  }
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === 'string' && URL_PROPERTY_PATTERN.test(key)) {
      properties[key] = redactEmails(value)
    }
  }
}

function redactExceptionProperties(properties: Properties): void {
  const values = properties.$exception_values
  if (Array.isArray(values)) {
    properties.$exception_values = values.map((value) =>
      typeof value === 'string' ? redactEmails(value) : value,
    )
  }

  const exceptions = properties.$exception_list
  if (Array.isArray(exceptions)) {
    for (const exception of exceptions) {
      if (typeof exception?.value === 'string') {
        exception.value = redactEmails(exception.value)
      }
    }
  }
}

/**
 * PostHog `before_send` hook.
 *
 * Some page URLs and failed request URLs hold user emails. Error Tracking
 * would otherwise store them in exception messages and URL breakdowns.
 */
export function redactPostHogEvent(
  event: CaptureResult | null,
): CaptureResult | null {
  if (!event) {
    return event
  }

  redactUrlProperties(event.properties)
  redactUrlProperties(event.$set)
  redactUrlProperties(event.$set_once)

  if (event.event === '$exception') {
    redactExceptionProperties(event.properties)
  }

  return event
}

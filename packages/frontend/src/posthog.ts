import posthog from 'posthog-js'

import appConfig from '@/config/app'
import { redactPostHogEvent } from '@/helpers/posthog-redaction'

const projectToken = appConfig.posthogProjectToken
const host = appConfig.posthogHost

export const isPostHogConfigured = projectToken && host

if (projectToken && host) {
  posthog.init(projectToken, {
    api_host: host,
    defaults: '2026-01-30',
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: true,
    },
    session_recording: {
      sampleRate: 0.1,
    },
    before_send: redactPostHogEvent,
  })
}

export default posthog

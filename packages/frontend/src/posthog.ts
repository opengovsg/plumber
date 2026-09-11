import posthog from 'posthog-js'

import appConfig from '@/config/app'

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
      capture_console_errors: false,
    },
  })
}

export default posthog

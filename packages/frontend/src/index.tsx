import '@fontsource/space-grotesk'

import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { datadogRum } from '@datadog/browser-rum'
import { MotionConfig } from 'framer-motion'

import ApolloProvider from '@/components/ApolloProvider'
import IntlProvider from '@/components/IntlProvider'
import router from '@/components/Router'
import ThemeProvider from '@/components/ThemeProvider'
import appConfig from '@/config/app'
import { AuthenticationProvider } from '@/contexts/Authentication'
import { LaunchDarklyProvider } from '@/contexts/LaunchDarkly'

const container = document.getElementById('root')

if (!container) {
  throw new Error('Unable to find root element')
}

const root = createRoot(container)

if (['prod', 'staging'].includes(appConfig.env)) {
  datadogRum.init({
    applicationId: '3bd09f62-dad8-4107-a907-1242dda9ee4d',
    clientToken: 'pubdc3dfc4ab0145729ebc91a19e9fae167',
    site: 'datadoghq.com',
    service: 'plumber',
    // deployed with cloudflare workers
    proxy: 'https://rum-proxy.plumber.gov.sg',
    env: appConfig.env,
    sessionSampleRate: 100,
    sessionReplaySampleRate: 100,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input',
  })
}
root.render(
  <ThemeProvider>
    <MotionConfig reducedMotion="always">
      <ApolloProvider>
        <AuthenticationProvider>
          <IntlProvider>
            <LaunchDarklyProvider>
              <RouterProvider router={router} />
            </LaunchDarklyProvider>
          </IntlProvider>
        </AuthenticationProvider>
      </ApolloProvider>
    </MotionConfig>
  </ThemeProvider>,
)

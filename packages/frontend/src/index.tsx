import '@fontsource/space-grotesk'

import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import ApolloProvider from 'components/ApolloProvider'
import IntlProvider from 'components/IntlProvider'
import router from 'components/Router'
import SnackbarProvider from 'components/SnackbarProvider'
import ThemeProvider from 'components/ThemeProvider'
import { AuthenticationProvider } from 'contexts/Authentication'

const container = document.getElementById('root')

if (!container) {
  throw new Error('Unable to find root element')
}
const root = createRoot(container)

root.render(
  <SnackbarProvider>
    <AuthenticationProvider>
      <ApolloProvider>
        <IntlProvider>
          <ThemeProvider>
            <RouterProvider router={router} />
          </ThemeProvider>
        </IntlProvider>
      </ApolloProvider>
    </AuthenticationProvider>
  </SnackbarProvider>,
)

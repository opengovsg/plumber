import { createRoot } from 'react-dom/client'
import ApolloProvider from 'components/ApolloProvider'
import IntlProvider from 'components/IntlProvider'
import Router from 'components/Router'
import SnackbarProvider from 'components/SnackbarProvider'
import ThemeProvider from 'components/ThemeProvider'
import { AuthenticationProvider } from 'contexts/Authentication'
import routes from 'routes'

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
            <Router>{routes}</Router>
          </ThemeProvider>
        </IntlProvider>
      </ApolloProvider>
    </AuthenticationProvider>
  </SnackbarProvider>,
)

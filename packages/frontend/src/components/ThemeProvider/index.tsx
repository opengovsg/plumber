import * as React from 'react'
import {
  THEME_ID,
  ThemeProvider as MaterialThemeProvider,
} from '@mui/material/styles'
import { ThemeProvider as ChakraThemeProvider } from '@opengovsg/design-system-react'
import materialTheme from 'styles/theme'

import { theme as chakraTheme } from '../../theme'

type ThemeProviderProps = {
  children: React.ReactNode
}

const ThemeProvider = ({
  children,
}: ThemeProviderProps): React.ReactElement => {
  return (
    <ChakraThemeProvider theme={chakraTheme}>
      <MaterialThemeProvider theme={{ [THEME_ID]: materialTheme }}>
        {children}
      </MaterialThemeProvider>
    </ChakraThemeProvider>
  )
}

export default ThemeProvider

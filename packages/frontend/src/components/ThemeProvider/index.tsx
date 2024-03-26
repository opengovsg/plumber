import { useRef } from 'react'
import { Box } from '@chakra-ui/react'
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
  // This is a workaround to fix the issue of toasts appearing behind modal overlays
  const ref = useRef<HTMLDivElement>(null)
  return (
    <ChakraThemeProvider
      theme={chakraTheme}
      toastOptions={{
        portalProps: {
          containerRef: ref,
        },
      }}
    >
      <MaterialThemeProvider theme={{ [THEME_ID]: materialTheme }}>
        <Box display="flex" flexDir="column" minH="100vh" ref={ref}>
          {children}
        </Box>
      </MaterialThemeProvider>
    </ChakraThemeProvider>
  )
}

export default ThemeProvider

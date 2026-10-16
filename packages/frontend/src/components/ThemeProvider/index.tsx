import { useRef } from 'react'
import { Box } from '@chakra-ui/react'
import { ThemeProvider as ChakraThemeProvider } from '@opengovsg/design-system-react'

import { useDefaultZoom } from '@/hooks/useGovtBrowser'

import { theme as chakraTheme } from '../../theme'

type ThemeProviderProps = {
  children: React.ReactNode
}

const ThemeProvider = ({
  children,
}: ThemeProviderProps): React.ReactElement => {
  // This is a workaround to fix the issue of toasts appearing behind modal overlays
  const ref = useRef<HTMLDivElement>(null)
  useDefaultZoom()
  return (
    <ChakraThemeProvider
      theme={chakraTheme}
      toastOptions={{
        portalProps: {
          containerRef: ref,
        },
      }}
    >
      <Box display="flex" flexDir="column" minH="100vh" ref={ref}>
        {children}
      </Box>
    </ChakraThemeProvider>
  )
}

export default ThemeProvider

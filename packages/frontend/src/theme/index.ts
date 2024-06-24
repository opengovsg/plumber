import { extendTheme, withDefaultColorScheme } from '@chakra-ui/react'
import { theme as ogpTheme } from '@opengovsg/design-system-react'

import { components } from './components'
import { foundations } from './foundations'

export const theme = extendTheme(
  ogpTheme,
  {
    ...foundations,
    components,
    styles: {
      global: {
        '@keyframes pulse': {
          '0%': {
            boxShadow: '0 0 0 0 rgba(186, 190, 203, 1)',
            transform: 'scale(0.9)',
          },
          '70%': {
            boxShadow: '0 0 0 10px rgba(186, 190, 203, 0)',
            transform: 'scale(1)',
          },
          '100%': {
            transform: 'scale(0.9)',
          },
        },
      },
    },
    Form: {
      helperText: {
        color: 'red',
      },
    },
  },
  withDefaultColorScheme({ colorScheme: 'primary' }),
)

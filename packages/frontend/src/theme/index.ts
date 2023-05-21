import { extendTheme } from '@chakra-ui/react'
import { theme as ogpTheme } from '@opengovsg/design-system-react'

import { components } from './components'
import { foundations } from './foundations'

export const theme = extendTheme(ogpTheme, {
  ...foundations,
  components,
})

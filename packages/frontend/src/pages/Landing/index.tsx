import { LightMode } from '@chakra-ui/react'
import { ThemeProvider } from '@opengovsg/design-system-react'
import { Footer } from 'components/Footer'

import { theme } from '../../theme'

import { AutomationLanding } from './AutomationLanding'
import { BottomLanding } from './BottomLanding'
import { MainLanding } from './MainLanding'

const Landing = () => {
  return (
    <ThemeProvider theme={theme}>
      <LightMode>
        <MainLanding />
        <AutomationLanding />
        <BottomLanding />
        <Footer />
      </LightMode>
    </ThemeProvider>
  )
}

export default Landing

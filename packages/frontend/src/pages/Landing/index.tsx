import { LightMode } from '@chakra-ui/react'
import { ThemeProvider } from '@opengovsg/design-system-react'

import { MainLanding } from './MainLanding'

const Landing = () => {
  return (
    <ThemeProvider>
      <LightMode>
        <MainLanding />
      </LightMode>
    </ThemeProvider>
  )
}

export default Landing

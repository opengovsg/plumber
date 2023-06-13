import { LightMode } from '@chakra-ui/react'
import { Footer } from 'components/Footer'

import { AutomationLanding } from './AutomationLanding'
import { BottomLanding } from './BottomLanding'
import { MainLanding } from './MainLanding'

const Landing = () => {
  return (
    <LightMode>
      <MainLanding />
      <AutomationLanding />
      <BottomLanding />
      <Footer />
    </LightMode>
  )
}

export default Landing

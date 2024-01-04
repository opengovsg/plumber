import { LightMode } from '@chakra-ui/react'
import { Footer } from 'components/Footer'

import Agencies from './Agencies'
import AutomationLanding from './AutomationLanding'
import MainLanding from './MainLanding'
import ToolsLanding from './ToolsLanding'
import TrainingSession from './TrainingSession'

const Landing = () => {
  return (
    <LightMode>
      <MainLanding />
      <Agencies />
      <ToolsLanding />
      <AutomationLanding />
      <TrainingSession />
      <Footer />
    </LightMode>
  )
}

export default Landing

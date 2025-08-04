import { Box, LightMode } from '@chakra-ui/react'

import Agencies from './Agencies'
import FaqSection from './FaqSection'
import FeatureSectionList from './FeatureSectionList'
import { Footer } from './Footer'
import HeaderBar from './HeaderBar'
import HeroSection from './HeroSection'
import UseCases from './UseCases'

export default function Landing() {
  return (
    <LightMode>
      <Box fontFamily="'DM Sans', sans-serif">
        <HeaderBar />
        <HeroSection />
        <Agencies />
        <FeatureSectionList />
        <UseCases />
        <FaqSection />
        <Footer />
      </Box>
    </LightMode>
  )
}

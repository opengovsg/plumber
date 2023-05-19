import { HStack } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

const HeaderBar = () => {
  return (
    <HStack>
      <div>Plumber</div>
      <HStack>
        <Button>Guide</Button>
        <Button>Login in</Button>
      </HStack>
    </HStack>
  )
}

export const MainLanding = () => {
  return (
    <div>
      <HeaderBar />
    </div>
  )
}

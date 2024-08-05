import { Image, VStack } from '@chakra-ui/react'
import { keyframes } from '@emotion/react'

import connector from '@/assets/landing/connector.svg'
import formSelectionTile from '@/assets/landing/formsSelectionTile.svg'
import postmanSelectionTile from '@/assets/landing/postmanSelectionTile.svg'
import tilesSelectionTile from '@/assets/landing/tilesSelectionTile.svg'

const expand = (order: number, fast?: boolean) => keyframes`
  0% {
    transform: scale(0);
  }
  ${(order - 1) * 12}% {
    transform: scale(0);
  }
  ${order * 12 - (fast ? 6 : 0)}% {
    transform: scale(1);
  }
  100% {
    transform: scale(1);
  }
`
const animation = (order: number, fast?: boolean) =>
  `${expand(order, fast)} 9s linear infinite`
const connectorProps = {
  w: '8%',
  maxW: '30px',
  zIndex: -1,
}

export const LandingAnimation = () => {
  return (
    <VStack
      spacing={{ base: -2.5, md: -1, lg: -2.5 }}
      w={{ base: '80vw', md: '50%' }}
      alignItems="center"
    >
      <Image src={formSelectionTile} animation={animation(1)} />
      <Image
        src={connector}
        animation={animation(2, true)}
        {...connectorProps}
      />
      <Image src={tilesSelectionTile} animation={animation(2.5)} />
      <Image
        src={connector}
        animation={animation(3.5, true)}
        {...connectorProps}
      />
      <Image src={postmanSelectionTile} animation={animation(4)} />
    </VStack>
  )
}

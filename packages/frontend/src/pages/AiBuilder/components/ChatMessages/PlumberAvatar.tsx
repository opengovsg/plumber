import { Image, ImageProps } from '@chakra-ui/react'

import plumberLogo from '@/assets/plumber-logo.svg'

const PlumberAvatar = (props: ImageProps) => {
  return (
    <Image
      src={plumberLogo}
      alt="Plumber"
      boxSize={6}
      borderRadius="md"
      flexShrink={0}
      {...props}
    />
  )
}

export default PlumberAvatar

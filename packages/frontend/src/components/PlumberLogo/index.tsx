import { Image } from '@chakra-ui/react'

import mainLogo from '@/assets/logo.svg'
import useIsPlumPro from '@/hooks/useIsPlumPro'

import PlumProLogo from './PlumProLogo'

export default function PlumberLogo(): JSX.Element {
  const isPlumPro = useIsPlumPro()

  if (isPlumPro) {
    return <PlumProLogo />
  }

  return <Image src={mainLogo} alt="Plumber" h={8} w={8} />
}

import { useEffect, useRef } from 'react'
import { Box, BoxProps } from '@chakra-ui/react'
import lottie, { AnimationConfigWithData } from 'lottie-web'

interface LottieWebAnimationProps extends BoxProps {
  animationData: AnimationConfigWithData['animationData']
}

export default function LottieWebAnimation(
  props: LottieWebAnimationProps,
): JSX.Element {
  const { animationData, ...boxProps } = props
  const lottieContainer = useRef(null)

  useEffect(() => {
    if (!lottieContainer.current) {
      return
    }

    const instance = lottie.loadAnimation({
      container: lottieContainer.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData,
    })
    // cleanup function to prevent lottie from creating 2 animations without cleaning up the first one
    return () => instance.destroy()
  }, [animationData])

  return <Box {...boxProps} ref={lottieContainer}></Box>
}

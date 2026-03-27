import { useEffect, useRef, useState } from 'react'
import { FaCircleCheck } from 'react-icons/fa6'
import { Box, Flex, Icon, Text } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'framer-motion'

const LoaderCore = ({
  loadingStates,
  value = 0,
}: {
  loadingStates: Array<{ text: string }>
  value?: number
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (containerRef.current && itemRefs.current[value]) {
      const container = containerRef.current
      const currentItem = itemRefs.current[value]

      if (currentItem) {
        const containerHeight = container.clientHeight
        const itemTop = currentItem.offsetTop
        const itemHeight = currentItem.clientHeight

        // Calculate scroll position to center the current item
        const scrollTop = itemTop - containerHeight / 2 + itemHeight / 2

        container.scrollTo({
          top: scrollTop,
          behavior: 'smooth',
        })
      }
    }
  }, [value])

  return (
    <Box
      ref={containerRef}
      overflow="hidden"
      position="relative"
      height="100%"
      width="fit-content"
      maxHeight="200px"
      margin="0 auto"
    >
      <Flex
        flexDirection="column"
        justifyContent="flex-start"
        gap={2}
        position="relative"
        paddingY="calc(50% - 20px)"
      >
        {loadingStates.map((loadingState, index) => {
          const distance = Math.abs(index - value)
          const opacity = Math.max(1 - distance * 0.3, 0)

          return (
            <Box key={index} ref={(el) => (itemRefs.current[index] = el)}>
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: opacity, y: 0 }}
                transition={{ duration: 0.2 }}
                style={{ opacity }}
              >
                <Flex gap={3} alignItems="center">
                  <Box
                    h="16px"
                    w="16px"
                    borderRadius="full"
                    bg={value > index ? 'primary.500' : 'primary.400'}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    flexShrink={0}
                    animation={
                      value === index
                        ? 'pulse 1.5s ease-in-out infinite'
                        : undefined
                    }
                    sx={{
                      '@keyframes pulse': {
                        '0%, 100%': { opacity: 1 },
                        '50%': { opacity: 0.5 },
                      },
                    }}
                  >
                    {value > index && (
                      <Icon
                        as={FaCircleCheck}
                        boxSize="14px"
                        color="white"
                        strokeWidth={3}
                      />
                    )}
                  </Box>
                  <Text
                    color={value > index ? 'gray.400' : 'content.primary'}
                    textStyle="body-1"
                  >
                    {loadingState.text}
                  </Text>
                </Flex>
              </motion.div>
            </Box>
          )
        })}
      </Flex>
    </Box>
  )
}

export const MultiStepLoader = ({
  loadingStates,
  loading,
  duration = 2000,
  loop = true,
}: {
  loadingStates: Array<{ text: string }>
  loading?: boolean
  duration?: number
  loop?: boolean
}) => {
  const [currentState, setCurrentState] = useState(0)

  useEffect(() => {
    if (!loading) {
      setCurrentState(0)
      return
    }
    const timeout = setTimeout(() => {
      setCurrentState((prevState) =>
        loop
          ? prevState === loadingStates.length - 1
            ? 0
            : prevState + 1
          : Math.min(prevState + 1, loadingStates.length - 1),
      )
    }, duration)

    return () => clearTimeout(timeout)
  }, [currentState, loading, loop, loadingStates.length, duration])

  return (
    <AnimatePresence mode="wait">
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
          }}
        >
          <LoaderCore value={currentState} loadingStates={loadingStates} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

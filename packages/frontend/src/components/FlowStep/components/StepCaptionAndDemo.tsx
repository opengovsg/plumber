import { IApp } from '@plumber/types'

import { Flex, Text } from '@chakra-ui/react'

interface StepCaptionProps {
  app?: IApp
  caption: string
}

export default function StepCaptionAndDemo(props: StepCaptionProps) {
  const { caption } = props
  return (
    <>
      <Flex direction="column" align="start" maxW="80%" flexShrink={1}>
        <Flex alignItems="center" gap={2} maxW="100%">
          <Text
            textStyle="subhead-1"
            color="base.content.default"
            whiteSpace="nowrap"
            overflow="hidden"
            textOverflow="ellipsis"
            maxW="100%"
          >
            {caption}
          </Text>
        </Flex>
      </Flex>
    </>
  )
}

// TODO (kevinkim-ogp): revert to below once arcade videos are ready

// interface StepCaptionProps {
//   app?: IApp
//   caption: string
// }

// const LOCAL_STORAGE_DEMO_TOOLTIP_KEY = 'demo-tooltip-clicked'

// export default function StepCaptionAndDemo(props: StepCaptionProps) {
//   const { app, caption } = props
//   // check whether user has opened the demo tooltip previously
//   const [hasSeenDemo, setHasSeenDemo] = useState<boolean>(
//     localStorage.getItem(LOCAL_STORAGE_DEMO_TOOLTIP_KEY) === 'true',
//   )

//   // for loading demo modal
//   const {
//     isOpen: isModalOpen,
//     onOpen: onModalOpen,
//     onClose: onModalClose,
//   } = useDisclosure()
//   const hasDemoVideo =
//     !!app?.demoVideoDetails?.url && !!app?.demoVideoDetails?.title

//   const handleDemoClick = useCallback(
//     (event: React.MouseEvent<SVGElement>) => {
//       event.stopPropagation()
//       onModalOpen()
//       localStorage.setItem(LOCAL_STORAGE_DEMO_TOOLTIP_KEY, 'true')
//       setHasSeenDemo(true)
//     },
//     [onModalOpen],
//   )

//   return (
//     <>
//       <Flex direction="column" align="start" maxW="80%" flexShrink={1}>
//         <Flex alignItems="center" gap={2} maxW="100%">
//           <Text
//             textStyle="subhead-1"
//             color="base.content.default"
//             whiteSpace="nowrap"
//             overflow="hidden"
//             textOverflow="ellipsis"
//             maxW="100%"
//           >
//             {caption}
//           </Text>
//           {hasDemoVideo && (
//             <Tooltip
//               label="Learn how to set this up"
//               placement="top-start"
//               openDelay={300}
//               gutter={0}
//             >
//               <Box boxSize="18px">
//                 <Icon
//                   as={BiHelpCircle}
//                   boxSize="inherit"
//                   sx={{
//                     borderRadius: '50%',
//                     animation: hasSeenDemo ? undefined : 'pulse 2s infinite',
//                   }}
//                   onClick={handleDemoClick}
//                 />
//               </Box>
//             </Tooltip>
//           )}
//         </Flex>
//       </Flex>
//       {isModalOpen && hasDemoVideo && (
//         <Modal isCentered isOpen={true} onClose={onModalClose} size="5xl">
//           <ModalOverlay bg="base.canvas.overlay" />
//           <ModalContent p={4} borderRadius={8}>
//             <DemoVideoModalContent
//               src={app?.demoVideoDetails?.url}
//               title={app?.demoVideoDetails?.title}
//             />
//           </ModalContent>
//         </Modal>
//       )}
//     </>
//   )
// }

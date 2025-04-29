import { IStep } from '@plumber/types'

import { ReactNode, useContext, useMemo } from 'react'
import { BiArrowFromRight } from 'react-icons/bi'
import { Box, Flex, Icon, Image, Text } from '@chakra-ui/react'

import { EditorContext } from '@/contexts/Editor'
import { getFlowStepHeaderWidth } from '@/helpers/editor'

import Error from './Content/Error'
import IfThen from './Content/IfThen'
import { flowStepGroupStyles } from './styles'

interface FlowStepGroupProps {
  stepsBeforeGroup: IStep[]
  groupedSteps: IStep[][]
  addStep: (
    previousStepId: string,
    appKey: string,
    eventKey: string,
    connectionId?: string,
  ) => Promise<IStep>
  children: ReactNode
}

export default function FlowStepGroup(props: FlowStepGroupProps) {
  const { groupedSteps, stepsBeforeGroup, children } = props
  const { isDrawerOpen, isMobile } = useContext(EditorContext)

  const { stepGroupType, stepGroupCaption } = useMemo(() => {
    let stepGroupType: string | null = null
    let stepGroupCaption: string | null = null

    if (groupedSteps[0]?.[0]?.key === 'ifThen') {
      stepGroupType = 'ifThen'
      stepGroupCaption = 'Conditional logic'
    }
    return { stepGroupType, stepGroupCaption }
  }, [groupedSteps])

  return (
    <Flex w="100%" alignItems="center" justifyContent="center">
      {/* FIXME (kevinkim-ogp): above is a temporary wrapper to ensure the flow step group is centered when drawer is closed */}
      <Flex
        {...flowStepGroupStyles.container}
        display={isMobile ? 'block' : 'flex'}
        w={getFlowStepHeaderWidth(isDrawerOpen, isMobile)}
      >
        <Box {...flowStepGroupStyles.header} w="100%">
          <Flex
            px={4}
            pt={4}
            alignItems="center"
            borderRadius="inherit"
            w="full"
            borderLeftWidth={isDrawerOpen ? 0 : '1px'}
            borderRightWidth={isDrawerOpen ? 0 : '1px'}
          >
            <Flex {...flowStepGroupStyles.iconWrapper}>
              {/* App icon */}
              <Image
                src={groupedSteps[0]?.[0]?.iconUrl}
                boxSize={8}
                fit="contain"
                fallback={
                  <Icon
                    boxSize={6}
                    as={BiArrowFromRight}
                    color="base.content.default"
                  />
                }
              />
            </Flex>
            <Flex direction="column" align="start">
              <Flex alignItems="center" gap={2}>
                <Text textStyle="subhead-1" color="base.content.default">
                  {stepGroupCaption}
                </Text>
              </Flex>
            </Flex>
          </Flex>
        </Box>
        {children}
        {stepGroupType === 'ifThen' ? (
          <IfThen
            groupedSteps={groupedSteps}
            stepsBeforeGroup={stepsBeforeGroup}
          />
        ) : (
          <Error />
        )}
      </Flex>
    </Flex>
  )
}

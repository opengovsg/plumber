import { IStep } from '@plumber/types'

import { useCallback, useContext, useMemo } from 'react'
import { BiTrash } from 'react-icons/bi'
import { Box, Flex, Icon, Text } from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'

import { EditorContext } from '@/contexts/Editor'
import { getFlowStepHeaderWidth, getToolboxIcon } from '@/helpers/editor'
import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'

import { MIN_FLOW_STEP_WIDTH } from '../Editor/constants'

import DeleteConfirmationDialog from './components/DeleteConfirmationDialog'
import Error from './Content/Error'
import ForEach from './Content/ForEach'
import IfThen from './Content/IfThen'
import useDeleteConfirmation from './hooks/useDeleteConfirmation'
import { flowStepGroupStyles } from './styles'

interface FlowStepGroupProps {
  stepsBeforeGroup: IStep[]
  groupedSteps: IStep[][]
}

export default function FlowStepGroup(props: FlowStepGroupProps) {
  const { groupedSteps, stepsBeforeGroup } = props
  const { isDrawerOpen, isMobile, onDrawerClose } = useContext(EditorContext)

  const { stepGroupType, stepGroupCaption } = useMemo(() => {
    let stepGroupType: string | null = null
    let stepGroupCaption: string | null = null

    const groupKey = groupedSteps[0]?.[0]?.key
    if (!groupKey) {
      return { stepGroupType: null, stepGroupCaption: null }
    }

    if (groupKey === TOOLBOX_ACTIONS.IfThen) {
      stepGroupType = TOOLBOX_ACTIONS.IfThen
      stepGroupCaption = 'If-then'
    }

    if (groupKey === TOOLBOX_ACTIONS.ForEach) {
      stepGroupType = TOOLBOX_ACTIONS.ForEach
      stepGroupCaption = 'For each'
    }

    return { stepGroupType, stepGroupCaption }
  }, [groupedSteps])

  const {
    isOpen: isDeleteConfirmationOpen,
    onOpen: openDeleteConfirmation,
    onClose: closeDeleteConfirmation,
    onDelete: deleteForEach,
    cancelRef,
  } = useDeleteConfirmation(stepGroupType ?? '', groupedSteps)

  const handleForEachDelete = useCallback(async () => {
    await deleteForEach()
    onDrawerClose()
  }, [deleteForEach, onDrawerClose])

  return (
    <Flex
      w="100%"
      alignItems="center"
      justifyContent={isDrawerOpen ? 'flex-start' : 'center'}
    >
      <Flex
        {...flowStepGroupStyles.container}
        display={isMobile ? 'block' : 'flex'}
        w={getFlowStepHeaderWidth(isDrawerOpen, isMobile)}
        minW={MIN_FLOW_STEP_WIDTH}
      >
        <Box {...flowStepGroupStyles.header} w="100%">
          <Flex
            px={4}
            pt={4}
            alignItems="center"
            borderRadius="inherit"
            w="full"
            borderLeftWidth={0}
            borderRightWidth={0}
            role="group"
          >
            <Flex {...flowStepGroupStyles.iconWrapper}>
              {/* App icon */}
              <Icon
                boxSize={8}
                as={getToolboxIcon(stepGroupType)}
                color="primary.500"
              />
            </Flex>
            <Flex direction="column" align="start">
              <Flex alignItems="center" gap={2}>
                <Text textStyle="subhead-1" color="base.content.default">
                  {stepGroupCaption}
                </Text>
              </Flex>
            </Flex>
            {stepGroupType === TOOLBOX_ACTIONS.ForEach && (
              <Flex ml="auto" opacity={0} _groupHover={{ opacity: 1 }}>
                <IconButton
                  boxSize={8}
                  variant="clear"
                  aria-label="Delete for each action"
                  icon={<BiTrash />}
                  colorScheme="secondary"
                  onClick={openDeleteConfirmation}
                />
              </Flex>
            )}
          </Flex>
        </Box>
        {stepGroupType === TOOLBOX_ACTIONS.IfThen ? (
          <IfThen
            groupedSteps={groupedSteps}
            stepsBeforeGroup={stepsBeforeGroup}
          />
        ) : stepGroupType === TOOLBOX_ACTIONS.ForEach ? (
          <>
            <ForEach
              groupedSteps={groupedSteps}
              stepsBeforeGroup={stepsBeforeGroup}
            />
            <DeleteConfirmationDialog
              name="For each"
              cancelRef={cancelRef}
              isOpen={isDeleteConfirmationOpen}
              onClose={closeDeleteConfirmation}
              onDelete={handleForEachDelete}
              onCancel={closeDeleteConfirmation}
            />
          </>
        ) : (
          <Error />
        )}
      </Flex>
    </Flex>
  )
}

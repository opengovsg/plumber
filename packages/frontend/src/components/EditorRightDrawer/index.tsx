import { IFlow } from '@plumber/types'

import { useCallback, useContext, useMemo } from 'react'
import { Box, CloseButton, Flex } from '@chakra-ui/react'

import { EDITOR_MAX_HEIGHT } from '@/components/Editor/constants'
import { EditorContext } from '@/contexts/Editor'
import { EditableTypography } from '@/exports/components'
import { useStepMetadata } from '@/hooks/useStepMetadata'

import Step from './Step'

interface EditorRightDrawerProps {
  flow: IFlow
  flowStepGroupIconUrl?: string
  index: number | null
  isLastStep: boolean
  steps: any[]
}

export default function EditorRightDrawer(props: EditorRightDrawerProps) {
  const { flow, index, isLastStep, steps } = props

  const {
    allApps,
    currentStepId,
    currentStepIndex,
    isDrawerOpen,
    isMobile,
    readOnly: isReadOnlyEditor,
    onDrawerClose,
    onDrawerOpen,
    setCurrentStepId,
    setCurrentStepIndex,
    onUpdateStep,
  } = useContext(EditorContext)

  const step = useMemo(() => {
    return steps.find((step) => step.id === currentStepId)
  }, [currentStepId, steps])

  const { caption } = useStepMetadata(allApps, step)

  const onStepRename = useCallback(
    async (value: string) => {
      await onUpdateStep({
        ...step,
        config: {
          ...step.config,
          stepName: value,
        },
      })
    },
    [onUpdateStep, step],
  )

  if (!currentStepId || !step) {
    return null
  }

  return (
    <Flex
      flexDir="column"
      position="relative"
      width={isDrawerOpen ? (isMobile ? '100vw' : '55%') : '0'}
      bg="white"
      py="4"
      borderRadius="lg"
      boxShadow="lg"
      transition="width 0.3s ease-in-out, transform 0.3s ease-in-out"
      display={isDrawerOpen ? 'block' : 'none'}
      transform={isDrawerOpen ? 'translateX(0)' : 'translateX(100%)'}
      maxHeight={EDITOR_MAX_HEIGHT}
      overflowY="auto"
    >
      <Flex
        alignItems="center"
        justifyContent="space-between"
        position="fixed"
        w="full"
        px="4"
      >
        {isReadOnlyEditor ? (
          <Box>{caption}</Box>
        ) : (
          <EditableTypography
            variant="body1"
            onConfirm={onStepRename}
            noWrap
            sx={{ display: 'flex', flex: 1, maxWidth: '30vw', ml: 1 }}
          >
            {caption}
          </EditableTypography>
        )}

        <CloseButton
          onClick={() => {
            onDrawerClose()
            setCurrentStepId(null)
          }}
          position="absolute"
          right="4"
        />
      </Flex>
      <Flex
        height="calc(100% - 1.5rem)"
        overflowY="auto"
        position="relative"
        px="4"
        top="2rem"
      >
        <Step
          index={index}
          step={step}
          isLastStep={index === steps.length - 1}
          onContinue={() => {
            if (!isLastStep && currentStepIndex !== null) {
              const nextStepIndex = currentStepIndex + 1
              const nextStepId = steps[nextStepIndex]?.id
              setCurrentStepId(nextStepId)
              setCurrentStepIndex(nextStepIndex)
            } else if (isLastStep) {
              onDrawerClose()
            }
          }}
          onOpen={onDrawerOpen}
          onClose={onDrawerClose}
          templateConfig={flow?.config?.templateConfig}
        />
      </Flex>
    </Flex>
  )
}

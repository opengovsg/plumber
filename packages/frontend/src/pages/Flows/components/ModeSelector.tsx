import { useEffect, useRef } from 'react'
import { Flex, FormControl } from '@chakra-ui/react'

import {
  FLOW_CREATE_MODE,
  useCreateFlowContext,
} from '@/pages/Flows/contexts/CreateFlowContext'

import ModeTile from './ModeTile'

const CARD_ADVANCE_DELAY_MS = 180

interface ModeSelectorProps {
  onModeSelect: (mode: FLOW_CREATE_MODE) => void
}

export default function ModeSelector({ onModeSelect }: ModeSelectorProps) {
  const { canUseAiBuilder, createMode, skipModeSelection, setCreateMode } =
    useCreateFlowContext()
  const isAdvancingRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleModeClick = (mode: FLOW_CREATE_MODE) => {
    if (isAdvancingRef.current) {
      return
    }

    setCreateMode(mode)

    // Hold the selected card long enough to register, then advance.
    if (mode !== 'new') {
      isAdvancingRef.current = true
      timeoutRef.current = setTimeout(() => {
        onModeSelect(mode)
      }, CARD_ADVANCE_DELAY_MS)
    }
  }

  return (
    <FormControl>
      {canUseAiBuilder && !skipModeSelection ? (
        <>
          <Flex gap={4} direction={{ base: 'column', sm: 'row' }} mb={4}>
            <ModeTile
              mode="ai"
              onClick={() => handleModeClick('ai')}
              isSelected={createMode === 'ai'}
            />
            <ModeTile
              mode="template"
              onClick={() => handleModeClick('template')}
              isSelected={createMode === 'template'}
            />
          </Flex>
          <ModeTile
            mode="new"
            onClick={() => handleModeClick('new')}
            isSelected={createMode === 'new'}
            w="100%"
          />
        </>
      ) : (
        <Flex gap={4} direction={{ base: 'column', sm: 'row' }}>
          <ModeTile
            mode="template"
            onClick={() => handleModeClick('template')}
            isSelected={createMode === 'template'}
          />
          <ModeTile
            mode="new"
            onClick={() => handleModeClick('new')}
            isSelected={createMode === 'new'}
          />
        </Flex>
      )}
    </FormControl>
  )
}

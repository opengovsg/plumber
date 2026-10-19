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

  const modes: FLOW_CREATE_MODE[] =
    canUseAiBuilder && !skipModeSelection
      ? ['ai', 'template', 'new']
      : ['template', 'new']

  return (
    <FormControl>
      <Flex gap={4} direction={{ base: 'column', md: 'row' }}>
        {modes.map((mode) => (
          <ModeTile
            key={mode}
            mode={mode}
            onClick={() => handleModeClick(mode)}
            isSelected={createMode === mode}
          />
        ))}
      </Flex>
    </FormControl>
  )
}

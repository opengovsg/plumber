import { Flex, FormControl } from '@chakra-ui/react'

import {
  FLOW_CREATE_MODE,
  useCreateFlowContext,
} from '@/pages/Flows/contexts/CreateFlowContext'

import ModeTile from './ModeTile'

export default function ModeSelector() {
  const { canUseAiBuilder, createMode, skipModeSelection, setCreateMode } =
    useCreateFlowContext()

  const handleModeClick = (mode: FLOW_CREATE_MODE) => {
    setCreateMode(mode)
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

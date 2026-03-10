import { FormEvent } from 'react'
import {
  BiBookOpen,
  BiPlus,
  BiRightArrowAlt,
  BiSolidMagicWand,
} from 'react-icons/bi'
import { Form, useNavigate } from 'react-router-dom'
import {
  Box,
  Flex,
  FormControl,
  Icon,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Text,
} from '@chakra-ui/react'
import { Button, FormLabel, Input, Tile } from '@opengovsg/design-system-react'

import NewBadge from '@/components/FlowStepConfigurationModal/ChooseAppAndEvent/NewBadge'
import * as URLS from '@/config/urls'
import { useCreateFlowContext } from '@/pages/Flows/contexts/CreateFlowContext'

export default function FlowNameAndModeContent({
  isButtonDisabled,
  inputRef,
  loading,
  flowName,
  handleInputChange,
  handleSubmit,
}: {
  isButtonDisabled: boolean
  loading: boolean
  inputRef: React.RefObject<HTMLInputElement>
  flowName: string
  handleInputChange: () => void
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const { canUseAiBuilder, createMode, skipModeSelection, setCreateMode } =
    useCreateFlowContext()
  const navigate = useNavigate()

  return (
    <Form onSubmit={handleSubmit}>
      <ModalHeader p="2.5rem 2rem 1.5rem">
        <Text textStyle="h4">How do you want to create your workflow?</Text>
      </ModalHeader>
      <ModalBody>
        <Flex flexDir="column" rowGap={4}>
          {canUseAiBuilder && !skipModeSelection && (
            <Tile
              icon={() => (
                <Box py={2}>
                  <BiSolidMagicWand fontSize="2rem" />
                </Box>
              )}
              flex={1}
              onClick={() => setCreateMode('ai')}
              isSelected={createMode === 'ai'}
              badge={<NewBadge />}
            >
              <Text textStyle="subhead-1">Build with AI</Text>
              <Text textStyle="body-2">
                Describe your workflow and we&apos;ll create the steps for you
              </Text>
            </Tile>
          )}

          <FormControl>
            <Flex gap={4} direction={{ base: 'column', sm: 'row' }}>
              <Tile
                icon={() => (
                  <Box py={2}>
                    <BiBookOpen fontSize="2rem" />
                  </Box>
                )}
                flex={1}
                onClick={() => navigate(URLS.TEMPLATES)}
                isSelected={createMode === 'template'}
              >
                <Text textStyle="subhead-1">Use a template</Text>
                <Text textStyle="body-2">
                  Choose from a pre-built workflow to customise
                </Text>
              </Tile>
              <Tile
                icon={() => (
                  <Box py={2}>
                    <BiPlus fontSize="2rem" />
                  </Box>
                )}
                flex={1}
                onClick={() => setCreateMode('new')}
                isSelected={createMode === 'new'}
              >
                <Text textStyle="subhead-1">Start from scratch</Text>
                <Text textStyle="body-2">
                  Use our builder to create your own workflow
                </Text>
              </Tile>
            </Flex>
          </FormControl>

          {/* Specific form items */}
          {createMode === 'new' && (
            <Flex flexDir="column">
              <FormControl isRequired>
                <FormLabel textStyle="subhead-1">Name your workflow</FormLabel>
                <Input
                  ref={inputRef}
                  placeholder="For e.g. track event feedback, send customised replies"
                  onChange={handleInputChange}
                  value={flowName}
                  required
                />
              </FormControl>
            </Flex>
          )}
        </Flex>
      </ModalBody>
      <ModalFooter>
        <Button type="submit" isDisabled={isButtonDisabled} isLoading={loading}>
          Next <Icon boxSize={6} as={BiRightArrowAlt} />
        </Button>
      </ModalFooter>
    </Form>
  )
}

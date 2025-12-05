import { FormEvent } from 'react'
import { BiBulb, BiPlus, BiSolidMagicWand } from 'react-icons/bi'
import { Form } from 'react-router-dom'
import {
  Flex,
  FormControl,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Text,
} from '@chakra-ui/react'
import {
  Button,
  FormLabel,
  Infobox,
  Input,
  Tile,
} from '@opengovsg/design-system-react'

import MarkdownRenderer from '@/components/MarkdownRenderer'
import { infoboxMdComponents } from '@/components/MarkdownRenderer/CustomMarkdownComponents'
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

  return (
    <Form onSubmit={handleSubmit}>
      <ModalHeader p="2.5rem 2rem 1.5rem">
        <Text textStyle="h4">Create Pipe</Text>
      </ModalHeader>
      <ModalBody>
        <Flex flexDir="column" rowGap={4}>
          {/* Specific form items */}
          <Flex flexDir="column">
            <FormControl isRequired>
              <FormLabel textStyle="subhead-1">Name your pipe</FormLabel>
              <Input
                ref={inputRef}
                placeholder="For e.g. track event feedback, send customised replies"
                onChange={handleInputChange}
                value={flowName}
                required
              />
            </FormControl>
          </Flex>

          {canUseAiBuilder && !skipModeSelection ? (
            <FormControl>
              <FormLabel isRequired>How do you want to start?</FormLabel>
              <Flex gap={4} direction={{ base: 'column', sm: 'row' }}>
                <Tile
                  icon={BiSolidMagicWand}
                  flex={1}
                  onClick={() => setCreateMode('ai-form')}
                  isSelected={createMode === 'ai-form'}
                >
                  <Text textStyle="h5">Build with AI</Text>
                  <Text textStyle="body-2">
                    Describe your workflow and we&apos;ll create the steps for
                    you
                  </Text>
                </Tile>
                <Tile
                  icon={BiPlus}
                  flex={1}
                  onClick={() => setCreateMode('new')}
                  isSelected={createMode === 'new'}
                >
                  <Text textStyle="h5">Start from scratch</Text>
                  <Text textStyle="body-2">
                    Great option if you already know what you want to do!
                  </Text>
                </Tile>
              </Flex>
            </FormControl>
          ) : (
            <Infobox icon={<BiBulb />} variant="primary">
              <MarkdownRenderer
                source={`Need suggestions on what to automate? [See use cases](${URLS.TEMPLATES})`}
                components={infoboxMdComponents}
              />
            </Infobox>
          )}
        </Flex>
      </ModalBody>
      <ModalFooter>
        <Button type="submit" isDisabled={isButtonDisabled} isLoading={loading}>
          {createMode === 'ai-form' ? 'Next' : 'Create'}
        </Button>
      </ModalFooter>
    </Form>
  )
}

import { Flex, FormControl } from '@chakra-ui/react'
import { FormLabel, Input } from '@opengovsg/design-system-react'

interface FlowNameInputProps {
  inputRef: React.RefObject<HTMLInputElement>
  flowName: string
  handleInputChange: () => void
}

export default function FlowNameInput({
  inputRef,
  flowName,
  handleInputChange,
}: FlowNameInputProps) {
  return (
    <Flex flexDir="column">
      {/* note: we need to specify isRequired otherwise an (optional) will appear */}
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
  )
}

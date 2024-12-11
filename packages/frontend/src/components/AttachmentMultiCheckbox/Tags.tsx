import { Tag, TagCloseButton, TagLabel } from '@chakra-ui/react'

interface TagsProps {
  selectedOptions: any[]
  onClick: (option: any, onChange: any, values: any, isChecked: boolean) => void
  onChange: (option: any) => void
  values: any[]
}

function Tags(props: TagsProps) {
  const { onClick, onChange, selectedOptions, values } = props

  if (selectedOptions.length === 0) {
    return <></>
  }

  return (
    <>
      {selectedOptions?.map((option) => {
        const { name, value } = option
        return (
          <Tag
            key={value as string}
            size="md"
            colorScheme="primary"
            borderRadius="md"
            ml="1"
            minW="40px"
            maxW="200px"
            flex="0 1 auto"
          >
            <TagLabel isTruncated flex="1 1 auto" minW="0" title={name}>
              {name}
            </TagLabel>
            <TagCloseButton
              onClick={() => onClick(option, onChange, values, false)}
            />
          </Tag>
        )
      })}
    </>
  )
}

export default Tags

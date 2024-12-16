import { Tag, TagCloseButton, TagLabel } from '@chakra-ui/react'

interface TagsProps {
  selectedOptions: any[]
  onClick: (option: any) => void
}

function TagList(props: TagsProps) {
  const { onClick, selectedOptions } = props

  if (selectedOptions.length === 0) {
    return <></>
  }

  return (
    <>
      {selectedOptions?.map((option) => {
        const { displayedValue, value } = option
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
            <TagLabel
              isTruncated
              flex="1 1 auto"
              minW="0"
              title={displayedValue}
            >
              {displayedValue}
            </TagLabel>
            <TagCloseButton onClick={() => onClick(option)} />
          </Tag>
        )
      })}
    </>
  )
}

export default TagList

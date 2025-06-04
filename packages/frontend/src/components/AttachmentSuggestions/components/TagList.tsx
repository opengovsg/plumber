import { Tag, TagCloseButton, TagLabel, Tooltip } from '@chakra-ui/react'

interface TagsProps {
  tags: any[]
  onClick: (option: any) => void
}

function TagList(props: TagsProps) {
  const { onClick, tags } = props

  const getLabel = (option: any, tooltip?: boolean) => {
    const { displayedValue, label, source, uploaded } = option

    if (tooltip) {
      return uploaded ? displayedValue : label
    }

    return uploaded ? `[Uploaded] ${displayedValue}` : `[${source}] ${label}`
  }

  if (tags.length === 0) {
    return <></>
  }

  return (
    <>
      {tags?.map((tag) => {
        const { label, value } = tag
        return (
          <Tag
            key={`${label}-${value}`}
            size="md"
            colorScheme="primary"
            borderRadius="md"
            ml="1"
            minW="40px"
            maxW="200px"
            flex="0 1 auto"
            h="100%"
          >
            <Tooltip hasArrow label={getLabel(tag, true)}>
              <TagLabel isTruncated flex="1 1 auto" minW="0">
                {getLabel(tag)}
              </TagLabel>
            </Tooltip>
            <TagCloseButton onClick={() => onClick(tag)} />
          </Tag>
        )
      })}
    </>
  )
}

export default TagList

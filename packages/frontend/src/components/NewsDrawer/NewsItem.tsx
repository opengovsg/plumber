import { useMemo } from 'react'
import { Box, Image, Text } from '@chakra-ui/react'
import MarkdownRenderer from 'components/MarkdownRenderer'
import { NEWS_DRAWER_COMPONENT } from 'components/MarkdownRenderer/Components/NewsDrawerComponent'
import { format } from 'date-fns'

export type NewsItemImage = {
  url: string
  alt: string
}
export interface NewsItemProps {
  date: Date
  title: string
  details: string
  image?: NewsItemImage
}

const DATE_FORMAT = 'dd MMM yyyy'

export default function NewsItem(props: NewsItemProps) {
  const { date, title, details, image } = props
  const formattedDate = format(date, DATE_FORMAT)

  const displayedImage = useMemo(() => {
    if (!image) {
      return
    }
    return (
      <Image fit="fill" src={image.url} title={image.alt} alt={image.alt} />
    )
  }, [image])

  return (
    <Box>
      <Text textStyle="caption-1" color="secondary.400">
        {formattedDate}
      </Text>
      <Text textStyle="h5" mb="0.5rem" mt="1rem" color="secondary.700">
        {title}
      </Text>
      <MarkdownRenderer
        source={details}
        components={NEWS_DRAWER_COMPONENT}
      ></MarkdownRenderer>
      <Box mb="1rem" mt="2rem" role="presentation">
        {displayedImage}
      </Box>
    </Box>
  )
}

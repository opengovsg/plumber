import { Box, Text } from '@chakra-ui/react'
import MarkdownRenderer from 'components/MarkdownRenderer'
import { NEWS_DRAWER_COMPONENT } from 'components/MarkdownRenderer/Components/NewsDrawerComponent'
import { format } from 'date-fns'

interface NewsItemProps {
  date: Date
  title: string
  details: string
  image?: string
}

const DATE_FORMAT = 'dd MMM yyyy'

export default function NewsItem(props: NewsItemProps) {
  const { date, title, details, image } = props
  const formattedDate = format(date, DATE_FORMAT)
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
    </Box>
  )
}
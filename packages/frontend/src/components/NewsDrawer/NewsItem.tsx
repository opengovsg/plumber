import { useMemo } from 'react'
import { Box, Image, Text } from '@chakra-ui/react'
import MarkdownRenderer from 'components/MarkdownRenderer'
import { NEWS_DRAWER_COMPONENT } from 'components/MarkdownRenderer/Components/NewsDrawerComponent'
import { format } from 'date-fns'
import { AnimationConfigWithData } from 'lottie-web'
import { RequireExactlyOne } from 'type-fest'

import LottieWebAnimation from './LottieWebAnimation'

export type NewsItemMultimedia = RequireExactlyOne<
  {
    url: string
    alt: string
    animationData: AnimationConfigWithData['animationData']
  },
  'url' | 'animationData'
>
export interface NewsItemProps {
  date: Date
  title: string
  details: string
  multimedia?: NewsItemMultimedia
}

const DATE_FORMAT = 'dd MMM yyyy'

export default function NewsItem(props: NewsItemProps) {
  const { date, title, details, multimedia } = props
  const formattedDate = format(date, DATE_FORMAT)

  const displayedMultimedia = useMemo(() => {
    if (!multimedia) {
      return
    }
    if (multimedia.animationData) {
      return (
        <LottieWebAnimation
          title={multimedia.alt}
          animationData={multimedia.animationData}
        ></LottieWebAnimation>
      )
    }
    return (
      <Image
        fit="fill"
        src={multimedia.url}
        title={multimedia.alt}
        alt={multimedia.alt}
      />
    )
  }, [multimedia])

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
        {displayedMultimedia}
      </Box>
    </Box>
  )
}

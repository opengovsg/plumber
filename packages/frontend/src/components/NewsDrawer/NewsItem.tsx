import React, { useMemo } from 'react'
import { Box, Image, Text } from '@chakra-ui/react'
import MarkdownRenderer from 'components/MarkdownRenderer'
import { AnimationConfigWithData } from 'lottie-web'
import { DateTime } from 'luxon'
import { RequireExactlyOne } from 'type-fest'

import LottieWebAnimation from './LottieWebAnimation'
import NewsItemTag from './NewsItemTag'

export type NewsItemMultimedia = RequireExactlyOne<
  {
    url: string
    animationData: AnimationConfigWithData['animationData']
  },
  'url' | 'animationData'
>
export interface NewsItemProps {
  date: string
  tag: string
  title: string
  details: string
  multimedia?: NewsItemMultimedia
}

const DATE_FORMAT = 'dd MMM yyyy'

export default function NewsItem(props: NewsItemProps) {
  const { date, tag, title, details, multimedia } = props
  const formattedDate = DateTime.fromISO(date).toFormat(DATE_FORMAT)
  const displayedMultimedia = useMemo(() => {
    if (!multimedia) {
      return
    }
    if (multimedia.animationData) {
      return (
        <LottieWebAnimation
          title={title}
          animationData={multimedia.animationData}
        />
      )
    }
    return <Image fit="fill" src={multimedia.url} title={title} alt={title} />
  }, [multimedia])

  return (
    <Box>
      <Text textStyle="caption-1" color="secondary.400">
        {formattedDate}
      </Text>
      <NewsItemTag tag={tag} />
      <Text textStyle="h6" mb="0.5rem" mt="1rem" color="base.content.default">
        {title}
      </Text>
      <MarkdownRenderer source={details}></MarkdownRenderer>
      <Box mb="1rem" mt="2rem">
        {displayedMultimedia}
      </Box>
    </Box>
  )
}

import React, { useMemo } from 'react'
import { BiSolidRocket } from 'react-icons/bi'
import { Box, Image, Text } from '@chakra-ui/react'
import { Badge, BadgeLeftIcon } from '@opengovsg/design-system-react'
import MarkdownRenderer from 'components/MarkdownRenderer'
import MarkdownComponent from 'components/MarkdownRenderer/Components'
import { format } from 'date-fns'
import { AnimationConfigWithData } from 'lottie-web'
import { RequireExactlyOne } from 'type-fest'

import LottieWebAnimation from './LottieWebAnimation'

const NEWS_MARKDOWN_COMPONENT = MarkdownComponent({
  styles: {
    text: {
      color: 'secondary.500',
      textStyle: 'body-1',
      fontSize: '1rem',
    },
    list: {
      color: 'secondary.500',
      marginInlineStart: '1.25em',
    },
  },
})

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
  isNewFeature?: boolean
  title: string
  details: string
  multimedia?: NewsItemMultimedia
}

const DATE_FORMAT = 'dd MMM yyyy'

export default function NewsItem(props: NewsItemProps) {
  const { date, isNewFeature = false, title, details, multimedia } = props
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
      {isNewFeature && (
        <Badge
          style={{
            borderRadius: '0.25rem',
            background: '#F9DDE9',
            color: '#CF1A68',
            marginTop: '1rem',
          }}
        >
          <React.Fragment>
            <BadgeLeftIcon
              as={BiSolidRocket}
              style={{ marginRight: '0.25rem' }}
            />
            New feature
          </React.Fragment>
        </Badge>
      )}
      <Text textStyle="h5" mb="0.5rem" mt="0.5rem" color="secondary.700">
        {title}
      </Text>
      <MarkdownRenderer
        source={details}
        components={NEWS_MARKDOWN_COMPONENT}
      ></MarkdownRenderer>
      <Box mb="1rem" mt="2rem">
        {displayedMultimedia}
      </Box>
    </Box>
  )
}

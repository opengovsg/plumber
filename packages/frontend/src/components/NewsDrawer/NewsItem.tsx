import React, { useMemo } from 'react'
import { BiSolidRocket } from 'react-icons/bi'
import { Box, Image, Text } from '@chakra-ui/react'
import { Badge, BadgeLeftIcon } from '@opengovsg/design-system-react'
import MarkdownRenderer from 'components/MarkdownRenderer'
import { AnimationConfigWithData } from 'lottie-web'
import { DateTime } from 'luxon'
import { RequireExactlyOne } from 'type-fest'

import LottieWebAnimation from './LottieWebAnimation'

const TIME_GAP_FOR_NEW_FEATURE = 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds

function isNewFeatureCheck(date: Date): boolean {
  const currDate = new Date()
  if (date > currDate) {
    return false
  }
  return currDate.getTime() - date.getTime() < TIME_GAP_FOR_NEW_FEATURE
}

export type NewsItemMultimedia = RequireExactlyOne<
  {
    url: string
    animationData: AnimationConfigWithData['animationData']
  },
  'url' | 'animationData'
>
export interface NewsItemProps {
  date: string
  title: string
  details: string
  multimedia?: NewsItemMultimedia
}

const DATE_FORMAT = 'dd MMM yyyy'

export default function NewsItem(props: NewsItemProps) {
  const { date, title, details, multimedia } = props
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
      {isNewFeatureCheck(new Date(date)) && (
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
      <MarkdownRenderer source={details}></MarkdownRenderer>
      <Box mb="1rem" mt="2rem">
        {displayedMultimedia}
      </Box>
    </Box>
  )
}

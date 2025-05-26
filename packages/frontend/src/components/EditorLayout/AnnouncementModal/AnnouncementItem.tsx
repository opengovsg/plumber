import { useMemo } from 'react'
import { Box, Image, ModalBody, ModalHeader, Text } from '@chakra-ui/react'
import { AnimationConfigWithData } from 'lottie-web'
import { RequireExactlyOne } from 'type-fest'

import MarkdownRenderer from '@/components/MarkdownRenderer'
import LottieWebAnimation from '@/components/NewsDrawer/LottieWebAnimation'

type AnnouncementItemMultimedia = RequireExactlyOne<
  {
    url: string
    animationData: AnimationConfigWithData['animationData']
  },
  'url' | 'animationData'
>

export interface AnnouncementItemProps {
  title: string
  details: string
  multimedia?: AnnouncementItemMultimedia
}

export default function AnnouncementItem(props: AnnouncementItemProps) {
  const { title, details, multimedia } = props
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
    return (
      <Image
        borderTopRadius="lg"
        fit="fill"
        src={multimedia.url}
        title={title}
        alt={title}
      />
    )
  }, [multimedia, title])

  return (
    <>
      {displayedMultimedia && <Box>{displayedMultimedia}</Box>}
      <ModalHeader>
        <Text textStyle="h4">{title}</Text>
      </ModalHeader>

      <ModalBody>
        <MarkdownRenderer source={details}></MarkdownRenderer>
      </ModalBody>
    </>
  )
}

import { Flex, Text } from '@chakra-ui/react'
import { Tile, TileProps } from '@opengovsg/design-system-react'
import { ReactElement } from 'react'
import { IconType } from 'react-icons'

export interface OptionTileProps extends Omit<
  TileProps,
  'icon' | 'title' | 'badge' | 'children'
> {
  icon: IconType
  title: string
  description: string
  badge?: ReactElement
}

export default function OptionTile(props: OptionTileProps): ReactElement {
  const { icon: TileIcon, title, description, badge, ...rest } = props

  return (
    <Tile
      icon={() => <TileIcon fontSize="1.5rem" />}
      flex={{ base: '0 0 auto', md: '1 1 0' }}
      minW={0}
      p={5}
      gap={4}
      css={{ display: 'flex', justifyContent: 'flex-start' }}
      {...rest}
    >
      <Flex direction="column" gap={1}>
        <Flex align="center" gap={2}>
          <Text textStyle="subhead-1" color="base.content.strong">
            {title}
          </Text>
          {badge}
        </Flex>
        <Text textStyle="body-2" color="base.content.medium">
          {description}
        </Text>
      </Flex>
    </Tile>
  )
}

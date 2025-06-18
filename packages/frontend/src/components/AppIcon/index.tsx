import { useState } from 'react'
import { BiPlus, BiSolidBolt } from 'react-icons/bi'
import { Avatar, AvatarProps, Icon } from '@chakra-ui/react'

export interface IAppIconProps extends Omit<AvatarProps, 'src'> {
  url?: string
  isTrigger?: boolean
}

function AppIcon(props: IAppIconProps): React.ReactElement {
  const { name, url, isTrigger, ...avatarProps } = props
  const [isLoaded, setIsLoaded] = useState(url ? false : true)

  return (
    <Avatar
      icon={
        <Icon
          as={isTrigger ? BiSolidBolt : BiPlus}
          color="grey.500"
          h="100%"
          w="100%"
          bg="grey.100"
          fontSize="xs"
          padding={2}
          borderRadius="md"
        />
      }
      onLoad={() => {
        setIsLoaded(true)
      }}
      onError={() => {
        setIsLoaded(true)
      }}
      display={isLoaded ? 'flex' : 'none'}
      src={url}
      name={name}
      bg="transparent"
      borderRadius="md"
      size="md"
      {...avatarProps}
    />
  )
}

export default AppIcon

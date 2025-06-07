import { useState } from 'react'
import { BiQuestionMark } from 'react-icons/bi'
import { Avatar, AvatarProps, Icon } from '@chakra-ui/react'

export interface IAppIconProps extends Omit<AvatarProps, 'src'> {
  url?: string
}

function AppIcon(props: IAppIconProps): React.ReactElement {
  const { name, url, color, ...avatarProps } = props
  const [isLoaded, setIsLoaded] = useState(url ? false : true)

  return (
    <Avatar
      icon={<Icon as={BiQuestionMark} />}
      onLoad={() => {
        setIsLoaded(true)
      }}
      display={isLoaded ? 'flex' : 'none'}
      src={url}
      name={name}
      bg={color}
      borderRadius="md"
      size="md"
      {...avatarProps}
    />
  )
}

export default AppIcon

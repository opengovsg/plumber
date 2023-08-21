import { IApp, IStep } from '@plumber/types'

import {
  type MouseEventHandler,
  type ReactNode,
  useCallback,
  useContext,
} from 'react'
import {
  BiQuestionMark,
  BiSolidCheckCircle,
  BiSolidErrorCircle,
  BiTrashAlt,
} from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import {
  Box,
  chakra,
  Collapse as CollapseWithHiddenOverflow,
  Flex,
  Icon,
  Image,
  Text,
} from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'
import { EditorContext } from 'contexts/Editor'
import { DELETE_STEP } from 'graphql/mutations/delete-step'
import useFormatMessage from 'hooks/useFormatMessage'

// Chakra's `Collapse` sets `overflow: hidden` by default, which causes dropdown
// menu items to be hidden. We override overflow by making `Collapse` a Chakra
// element.
const Collapse = chakra(CollapseWithHiddenOverflow)

interface StepHeaderProps {
  step: IStep
  app?: IApp | null
  onClick: () => void
  collapsed: boolean
  children: ReactNode
}

export default function StepHeader(props: StepHeaderProps): JSX.Element {
  const { step, app, onClick, collapsed, children } = props

  const formatMessage = useFormatMessage()
  const editorContext = useContext(EditorContext)

  const [deleteStep] = useMutation(DELETE_STEP, {
    refetchQueries: ['GetFlow'],
  })
  const handleDelete = useCallback<MouseEventHandler>(
    async (e) => {
      e.stopPropagation()
      await deleteStep({ variables: { input: { id: step.id } } })
    },
    [step.id],
  )

  const isTrigger = step.type === 'trigger'
  const isCompletedStep = step.status === 'completed'
  const isDeletable = !isTrigger && !editorContext.readOnly
  const appIcon = app?.iconUrl
  const caption = app?.name ? `${step.position}. ${app?.name}` : 'Choose an app'

  return (
    <Box
      w="full"
      borderWidth="1px"
      borderColor="line.light"
      borderRadius="lg"
      p={0}
    >
      {/*
       * Top header
       */}
      <Flex
        p={4}
        alignItems="center"
        _hover={{ bg: 'secondary.50', cursor: 'pointer' }}
        w="full"
        onClick={onClick}
      >
        <Box position="relative" h={16} w={16} mr={4}>
          {/*
           * App icon
           */}
          <Image
            src={appIcon}
            boxSize="full"
            borderRadius="base"
            fit="contain"
            fallback={
              <Icon
                boxSize="full"
                color="white"
                bg="primary.500"
                as={BiQuestionMark}
                borderRadius="base"
              />
            }
          />
          {/*
           * Step ompletion status badge
           */}
          <Flex
            position="absolute"
            top={0}
            insetEnd={0}
            boxSize={6}
            transform="translate(0.5rem, -0.5rem)"
            borderRadius="full"
            bg="white"
          >
            {isCompletedStep ? (
              <Icon
                boxSize="full"
                color="badge.green"
                as={BiSolidCheckCircle}
              />
            ) : (
              <Icon
                boxSize="full"
                color="badge.yellow"
                as={BiSolidErrorCircle}
              />
            )}
          </Flex>
        </Box>
        {/*
         * Captions
         */}
        <Flex direction="column" align="start">
          <Text
            fontSize="sm"
            fontWeight="normal"
            lineHeight="shorter"
            p={0}
            mb={1.5}
            color="#686868"
          >
            {isTrigger
              ? formatMessage('flowStep.triggerType')
              : formatMessage('flowStep.actionType')}
          </Text>
          <Text
            fontSize="md"
            fontWeight="medium"
            color="secondary.900"
            lineHeight="base"
            as="strong"
          >
            {caption}
          </Text>
        </Flex>

        {/*
         * Delete step button
         */}
        {isDeletable && (
          <Flex ml="auto">
            <IconButton
              onClick={handleDelete}
              variant="clear"
              aria-label="Delete Step"
              icon={<BiTrashAlt />}
            />
          </Flex>
        )}
      </Flex>

      {/*
       * Step contents
       */}
      <Collapse
        in={!collapsed}
        unmountOnExit
        overflow={collapsed ? 'hidden' : 'initial !important'}
      >
        <Box borderTopWidth={1} p={0}>
          {children}
        </Box>
      </Collapse>
    </Box>
  )
}

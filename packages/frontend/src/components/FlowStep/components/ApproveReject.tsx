import { useCallback, useContext, useState } from 'react'
import {
  Box,
  Flex,
  Popover,
  PopoverAnchor,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  Tab,
  TabList,
  TabProps,
  Tabs,
  Text,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import { MrfContext } from '@/contexts/MrfContext'
import {
  dismissMrfApprovalHint,
  hasSeenMrfApprovalHint,
} from '@/helpers/formsg'

const tabStyle = (primaryColor: string): TabProps => {
  return {
    _selected: {
      color: 'white',
      bg: primaryColor,
      _hover: {
        color: 'white',
      },
    },
    _hover: {
      color: primaryColor,
    },
    bg: 'transparent',
    letterSpacing: '0',
    fontWeight: 'medium',
    textTransform: 'none',
    borderRadius: 'md',
    w: '50%',
    px: 4,
    py: 1.5,
    fontSize: 'medium',
  }
}

export function ApproveReject({ stepId }: { stepId: string }) {
  const { approvalBranches, setApprovalBranch } = useContext(MrfContext)

  const isApproveBranch = approvalBranches[stepId] === 'approve'

  const [isHintOpen, setIsHintOpen] = useState(false)

  const dismissHint = useCallback(() => {
    setIsHintOpen(false)
    dismissMrfApprovalHint()
  }, [])

  const onChange = useCallback(
    (index: number) => {
      const branch = index === 0 ? 'approve' : 'reject'
      setApprovalBranch(stepId, branch)
      // Show the one-way reminder the first time a user reaches for "If rejected",
      // the clearest signal they may think they're configuring the form itself.
      if (branch === 'reject' && !hasSeenMrfApprovalHint()) {
        setIsHintOpen(true)
      } else {
        // Close the hint if they switch back to "If approved" while it's open.
        setIsHintOpen(false)
      }
    },
    [stepId, setApprovalBranch],
  )

  return (
    <Flex flexDir="column" w="100%" maxW="600px" px={4} pb={3} gap={1}>
      <Box onClick={(e) => e.stopPropagation()}>
        <Popover
          isOpen={isHintOpen}
          onClose={() => setIsHintOpen(false)}
          placement="bottom"
          closeOnBlur={false}
        >
          <PopoverAnchor>
            <Tabs
              variant="enclosed-colored"
              index={isApproveBranch ? 0 : 1}
              backgroundColor="base.divider.medium"
              py={1}
              px={0.5}
              borderRadius="md"
              onChange={onChange}
              flex={1}
            >
              <TabList gap={2} overflow="hidden">
                <Tab {...tabStyle('green.500')}>If approved</Tab>
                <Tab {...tabStyle('red.500')}>If rejected</Tab>
              </TabList>
            </Tabs>
          </PopoverAnchor>
          <PopoverContent>
            <PopoverArrow />
            <PopoverBody>
              <Text textStyle="body-2" color="base.content.default" mb={3}>
                To change who approves for the steps, edit your form in FormSG,
                then click &ldquo;Check step&rdquo; to sync. Editing here
                won&rsquo;t change your form.
              </Text>
              <Flex justifyContent="flex-end">
                <Button size="xs" onClick={dismissHint}>
                  Okay
                </Button>
              </Flex>
            </PopoverBody>
          </PopoverContent>
        </Popover>
      </Box>
      <Text textStyle="body-2" color="base.content.medium">
        This approval comes from your form in FormSG. Choosing a branch here
        only tells Plumber what to do next. It won&rsquo;t change your form.
      </Text>
    </Flex>
  )
}

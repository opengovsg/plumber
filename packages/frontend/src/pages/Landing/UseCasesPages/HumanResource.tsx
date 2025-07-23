import { Box, Text } from '@chakra-ui/react'

import { Footer } from '../Footer'
import HeaderBar from '../HeaderBar'

import ContentBox from './components/ContentBox'
import ContentSection from './components/ContentSection'
import SummarySection from './components/SummarySection'

function FirstContentBox() {
  return (
    <ContentBox headerText="Life before Plumber">
      <Text>
        Prior to automating this process, onboarding was managed manually. This
        included information seeking and declaration through emails. Upon
        receipt of information, HR staff will forward it to relevant
        stakeholders to process onboarding items, such as staff passes.
      </Text>

      <Text>
        This process was prone to human error. For instance, a missed or delayed
        referral by HR will affect an employees’ onboarding experience.
      </Text>
    </ContentBox>
  )
}

function SecondContentBox() {
  return (
    <ContentBox headerText="Paving the way for transformation">
      <Text>
        Zhi Hao, a HR Business Partner in AGC, reviewed the existing operational
        process and identified some process steps for potential automation. The
        scope of change started small but he gradually expanded automating more
        parts of the workflow.
      </Text>

      <Text>
        With Plumber, the information is now directly available to stakeholders
        after the employees’ input without the need for manual referral.
      </Text>
    </ContentBox>
  )
}

function ThirdContentBox() {
  return (
    <ContentBox headerText="A better HR experience for all">
      <Text>
        50 employees have been onboard over the past 6 months since this process
        was automated. This amounts to 50 hours of administrative time saved,
        which has gone into other HR strategic objectives.
      </Text>

      <Text>
        The team transitioned into the automated work process late last year and
        is periodically reviewing it for improvement.
      </Text>
    </ContentBox>
  )
}

export default function HumanResource() {
  return (
    <Box fontFamily="'DM Sans', sans-serif">
      <HeaderBar />

      <SummarySection
        category="Human Resource"
        title="How Attorney General's Chamber reduced 50% of time spent on administrative onboarding processes"
        description="Administrative work to onboard a new joiner on their first day of work typically took around 2 hours cumulatively, and was prone to human error"
        benefits={[
          '50% time saved to onboard new employee',
          '95% reduction in errors by automating',
          'Able to focus on more important work like strategy after automating process',
        ]}
      />

      <ContentSection
        contentBoxes={
          <>
            <FirstContentBox />
            <SecondContentBox />
            <ThirdContentBox />
          </>
        }
      />

      <Footer />
    </Box>
  )
}

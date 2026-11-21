import { gql } from '@apollo/client'

export const TRIGGER_FLOW_MANUALLY = gql`
  mutation TriggerFlowManually($input: TriggerFlowManuallyInput) {
    triggerFlowManually(input: $input)
  }
`

import { BadUserInputError } from '@/errors/graphql-errors'

// NOTE: we check that the input.flow.updatedAt is the same as the flow.updatedAt
// to prevent users from updating the pipe when the steps are outdated.
// inputUpdatedAt is a timestamp string that is passed in from the frontend
// flowUpdatedAt is an ISO date string that is fetched from the database
const checkFlowUpdatable = (inputUpdatedAt: string, flowUpdatedAt: string) => {
  if (Number(inputUpdatedAt) !== new Date(flowUpdatedAt).getTime()) {
    throw new BadUserInputError(
      'Pipe is outdated. Refresh the page and try again.',
    )
  }
}

export default checkFlowUpdatable

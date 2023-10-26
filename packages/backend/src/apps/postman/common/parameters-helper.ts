import Flow from '@/models/flow'

export async function getDefaultReplyTo(flowId: string): Promise<string> {
  const flow = await Flow.query()
    .findById(flowId)
    .withGraphFetched({ user: true })
    .throwIfNotFound()
  return flow.user.email
}

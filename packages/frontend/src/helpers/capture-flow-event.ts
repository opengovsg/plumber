import posthog, { isPostHogConfigured } from '@/posthog'

export type FlowEvent =
  | {
      name: 'flow_editor:field_tab_changed'
      properties: {
        tab_key: string
        from: string | undefined
        to: string
        step_id: string | undefined
      }
    }
  | {
      name: 'flow_editor:send_mode_saved'
      properties: {
        from: string
        to: string
        step_id: string
        step_created_at: string | undefined
        flow_published: boolean
      }
    }

/** Every flow event carries flow_id so insights can group by pipe. */
export function captureFlowEvent(
  flowId: string | undefined,
  event: FlowEvent,
): void {
  if (!isPostHogConfigured) {
    return
  }
  posthog.capture(event.name, { ...event.properties, flow_id: flowId })
}

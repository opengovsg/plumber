import { describe, expect, it } from 'vitest'

import {
  appendStepAiBuilderEvent,
  clearConnectionConflict,
  createStepAiBuilderConfig,
  setConnectionConflict,
  stampStepDeletedByAi,
} from '../step-ai-builder-config'

describe('step AI builder config', () => {
  it('stamps create_pipe origin', () => {
    expect(createStepAiBuilderConfig('trace-1', 'create_pipe')).toEqual({
      aiBuilderConfig: [
        {
          traceId: 'trace-1',
          tool: 'create_pipe',
        },
      ],
    })
  })

  it('skips empty trace ids', () => {
    expect(createStepAiBuilderConfig('', 'create_pipe')).toEqual({})
  })

  it('stamps create_step origin', () => {
    expect(createStepAiBuilderConfig('trace-2', 'create_step')).toEqual({
      aiBuilderConfig: [
        {
          traceId: 'trace-2',
          tool: 'create_step',
        },
      ],
    })
  })

  it('appends delete_step on an AI-created step', () => {
    expect(
      stampStepDeletedByAi(
        {
          aiBuilderConfig: [
            {
              traceId: 'trace-create',
              tool: 'create_pipe',
            },
          ],
        },
        'trace-delete',
      ),
    ).toEqual({
      aiBuilderConfig: [
        {
          traceId: 'trace-create',
          tool: 'create_pipe',
        },
        {
          traceId: 'trace-delete',
          tool: 'delete_step',
        },
      ],
    })
  })

  it('stamps delete_step on a user-created step', () => {
    expect(stampStepDeletedByAi({}, 'trace-delete')).toEqual({
      aiBuilderConfig: [
        {
          traceId: 'trace-delete',
          tool: 'delete_step',
        },
      ],
    })
  })

  it('appends update_step_parameters once per trace', () => {
    const first = appendStepAiBuilderEvent(
      {
        aiBuilderConfig: [
          {
            traceId: 'trace-create',
            tool: 'create_pipe',
          },
        ],
      },
      { traceId: 'trace-update', tool: 'update_step_parameters' },
      { skipIfRecorded: true },
    )

    expect(first).toEqual({
      aiBuilderConfig: [
        {
          traceId: 'trace-create',
          tool: 'create_pipe',
        },
        {
          traceId: 'trace-update',
          tool: 'update_step_parameters',
        },
      ],
    })

    expect(
      appendStepAiBuilderEvent(
        first,
        { traceId: 'trace-update', tool: 'update_step_parameters' },
        { skipIfRecorded: true },
      ),
    ).toEqual(first)
  })

  it('records a connection conflict beside existing config', () => {
    expect(
      setConnectionConflict({ stepName: 'Trigger' }, 'conn-1', 'trace-1'),
    ).toEqual({
      stepName: 'Trigger',
      aiBuilderConnectionConflict: {
        connectionId: 'conn-1',
        traceId: 'trace-1',
      },
    })
    expect(setConnectionConflict(null, 'conn-1')).toEqual({
      aiBuilderConnectionConflict: { connectionId: 'conn-1' },
    })
  })

  it('clears a connection conflict and keeps the rest', () => {
    expect(
      clearConnectionConflict({
        stepName: 'Trigger',
        aiBuilderConnectionConflict: { connectionId: 'conn-1' },
      }),
    ).toEqual({ stepName: 'Trigger' })
    expect(clearConnectionConflict(undefined)).toEqual({})
  })
})

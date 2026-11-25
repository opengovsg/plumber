import { describe, expect, it } from 'vitest'

import { isStillOnPipe } from '../abandon'

const FLOW_ID = '8fed2151-8753-458f-82a5-76ba8db08725'

describe('isStillOnPipe', () => {
  it.each([
    ['the editor', `/editor/${FLOW_ID}`],
    ['the share settings', `/editor/${FLOW_ID}/share`],
    ['the notification settings', `/editor/${FLOW_ID}/notifications`],
    ['the transfer settings', `/editor/${FLOW_ID}/transfer`],
    ['the connection settings', `/editor/${FLOW_ID}/connections`],
    ['the executions page', `/execution-pipe/${FLOW_ID}`],
  ])('treats %s as still on the pipe', (_name, pathname) => {
    expect(isStillOnPipe(pathname, FLOW_ID)).toBe(true)
  })

  it.each([
    ['the dashboard', '/flows'],
    ['the templates page', '/templates'],
    ['another pipe', '/editor/11111111-1111-4111-8111-111111111111'],
    ['the executions list', '/executions'],
  ])('treats %s as leaving the pipe', (_name, pathname) => {
    expect(isStillOnPipe(pathname, FLOW_ID)).toBe(false)
  })

  it('does not match a path that only contains the id as a substring', () => {
    expect(isStillOnPipe(`/editor/${FLOW_ID}-copy`, FLOW_ID)).toBe(false)
  })
})

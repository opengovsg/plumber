import { describe, expect, it } from 'vitest'

import { parseWorkflowMetadata } from '../parse-workflow-metadata'

const VALID_WORKFLOW = `
<!-- WORKFLOW_METADATA
name: Welcome Email Workflow
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    stepName: New form submission
    description: Configure to trigger when a new FormSG submission is received
  - step: 2
    appKey: postman
    key: sendTransactionalEmail
    stepName: Send welcome email
    description: Send a transactional email to the new user
  - step: 3
    appKey: postman-sms
    key: sendSms
    stepName: Send welcome SMS
    description: Send an SMS to the new user
-->
`

describe('parseWorkflowMetadata', () => {
  describe('valid metadata', () => {
    it('extracts trigger and actions', () => {
      const result = parseWorkflowMetadata(VALID_WORKFLOW)

      expect(result.trigger).toMatchObject({
        type: 'trigger',
        appKey: 'formsg',
        key: 'newSubmission',
      })
      expect(result.actions).toHaveLength(2)
      expect(result.actions[0]).toMatchObject({
        type: 'action',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
      })
    })

    it('uses name from metadata', () => {
      expect(parseWorkflowMetadata(VALID_WORKFLOW).name).toBe(
        'Welcome Email Workflow',
      )
    })

    it('defaults name to "Build with AI" when absent', () => {
      const text = `
<!-- WORKFLOW_METADATA
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    description: Trigger
  - step: 2
    appKey: postman
    key: sendTransactionalEmail
    description: Action
-->
`
      expect(parseWorkflowMetadata(text).name).toBe('Build with AI')
    })

    it('uses stepName for config.stepName', () => {
      const result = parseWorkflowMetadata(VALID_WORKFLOW)
      expect(result.actions[0].config.stepName).toBe('Send welcome email')
    })

    it('falls back to key when stepName is absent', () => {
      const text = `
<!-- WORKFLOW_METADATA
name: Test
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    description: Trigger
  - step: 2
    appKey: postman
    key: sendTransactionalEmail
    description: Action
-->
`
      expect(parseWorkflowMetadata(text).actions[0].config.stepName).toBe(
        'sendTransactionalEmail',
      )
    })

    it('sets parameters with branchName for if-then steps', () => {
      const text = `
<!-- WORKFLOW_METADATA
name: Priority Routing
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    description: Trigger
  - step: 2
    appKey: toolbox
    key: ifThen
    stepName: Check priority
    description: Check if priority is high
    branchName: Priority is High
  - step: 3
    appKey: postman
    key: sendTransactionalEmail
    stepName: Send email
    description: Send high-priority email
-->
`
      const result = parseWorkflowMetadata(text)
      expect(result.actions[0].parameters).toStrictEqual({
        depth: 0,
        branchName: 'Priority is High',
      })
    })

    it('adds templateConfig to each action', () => {
      const result = parseWorkflowMetadata(VALID_WORKFLOW)
      for (const action of result.actions) {
        expect(action.config.templateConfig).toStrictEqual({})
      }
    })
  })

  describe('invalid metadata format', () => {
    it('throws when no WORKFLOW_METADATA block is present', () => {
      expect(() => parseWorkflowMetadata('Just a plain response')).toThrow(
        'Unable to generate the workflow.',
      )
    })

    it('throws on malformed YAML', () => {
      expect(() =>
        parseWorkflowMetadata(`<!-- WORKFLOW_METADATA
: bad yaml: [unclosed
-->`),
      ).toThrow('Unable to generate the workflow.')
    })

    it('throws when steps field is missing', () => {
      expect(() =>
        parseWorkflowMetadata(`<!-- WORKFLOW_METADATA
name: My Workflow
-->`),
      ).toThrow('Unable to generate the workflow.')
    })

    it('throws when steps array is empty', () => {
      expect(() =>
        parseWorkflowMetadata(`<!-- WORKFLOW_METADATA
name: My Workflow
steps: []
-->`),
      ).toThrow('Unable to generate the workflow.')
    })
  })

  describe('schema validation', () => {
    it('throws when trigger appKey does not exist', () => {
      expect(() =>
        parseWorkflowMetadata(`<!-- WORKFLOW_METADATA
name: My Workflow
steps:
  - step: 1
    appKey: nonexistent-app
    key: someKey
    description: Trigger
  - step: 2
    appKey: postman
    key: sendTransactionalEmail
    description: Action
-->`),
      ).toThrow('Invalid trigger detected.')
    })

    it('throws when action key is invalid for the given appKey', () => {
      expect(() =>
        parseWorkflowMetadata(`<!-- WORKFLOW_METADATA
name: My Workflow
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    description: Trigger
  - step: 2
    appKey: postman
    key: nonExistentAction
    description: Action
-->`),
      ).toThrow('Invalid action detected at step 2.')
    })

    it('throws when there are no actions (only a trigger)', () => {
      expect(() =>
        parseWorkflowMetadata(`<!-- WORKFLOW_METADATA
name: My Workflow
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    description: Trigger
-->`),
      ).toThrow('At least one action step is required.')
    })

    it('throws when trigger uses a restricted app', () => {
      expect(() => parseWorkflowMetadata(VALID_WORKFLOW, ['formsg'])).toThrow(
        'Invalid trigger detected.',
      )
    })

    it('throws when an action uses a restricted app', () => {
      expect(() => parseWorkflowMetadata(VALID_WORKFLOW, ['postman'])).toThrow(
        'Invalid action detected at step 2.',
      )
    })

    it('throws when if-then is the last action', () => {
      expect(() =>
        parseWorkflowMetadata(`<!-- WORKFLOW_METADATA
name: My Workflow
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    description: Trigger
  - step: 2
    appKey: postman
    key: sendTransactionalEmail
    description: Action
  - step: 3
    appKey: toolbox
    key: ifThen
    description: If-then at end
-->`),
      ).toThrow(
        'If-then actions must have another action immediately after them',
      )
    })

    it('throws when if-then actions are consecutive', () => {
      expect(() =>
        parseWorkflowMetadata(`<!-- WORKFLOW_METADATA
name: My Workflow
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    description: Trigger
  - step: 2
    appKey: toolbox
    key: ifThen
    description: First if-then
  - step: 3
    appKey: toolbox
    key: ifThen
    description: Second if-then
  - step: 4
    appKey: postman
    key: sendTransactionalEmail
    description: Action
-->`),
      ).toThrow(
        'If-then actions cannot be consecutive - must alternate with non-if-then actions',
      )
    })

    it('throws when for-each is placed after an if-then', () => {
      expect(() =>
        parseWorkflowMetadata(`<!-- WORKFLOW_METADATA
name: My Workflow
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    description: Trigger
  - step: 2
    appKey: toolbox
    key: ifThen
    description: If-then
  - step: 3
    appKey: postman
    key: sendTransactionalEmail
    description: Action
  - step: 4
    appKey: toolbox
    key: forEach
    description: For-each after if-then
-->`),
      ).toThrow('For-each action cannot be placed after an if-then action')
    })

    it('throws when a delay action is placed after a for-each', () => {
      expect(() =>
        parseWorkflowMetadata(`<!-- WORKFLOW_METADATA
name: My Workflow
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    description: Trigger
  - step: 2
    appKey: toolbox
    key: forEach
    description: Loop
  - step: 3
    appKey: delay
    key: delayFor
    description: Delay after loop
-->`),
      ).toThrow('Delay action cannot be added after a for-each step')
    })

    it('throws when there is more than one for-each', () => {
      expect(() =>
        parseWorkflowMetadata(`<!-- WORKFLOW_METADATA
name: My Workflow
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    description: Trigger
  - step: 2
    appKey: toolbox
    key: forEach
    description: First loop
  - step: 3
    appKey: postman
    key: sendTransactionalEmail
    description: Action
  - step: 4
    appKey: toolbox
    key: forEach
    description: Second loop
-->`),
      ).toThrow('There can only be 1 for-each action in each pipe')
    })
  })
})

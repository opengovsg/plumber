/**
 * Compact WORKFLOW_METADATA schema shared by static prompt fallbacks.
 * Kept in sync with parseWorkflowMetadata / VALID_WORKFLOW in unit tests.
 */
export const WORKFLOW_METADATA_FORMAT = `Emit exactly one HTML comment block in this form (YAML inside). The UI parses it strictly.

<!-- WORKFLOW_METADATA
name: Short pipe name
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    stepName: New form submission
    description: Trigger when a new FormSG submission is received
  - step: 2
    appKey: postman
    key: sendTransactionalEmail
    stepName: Send email
    description: Send a transactional email
-->

Rules:
- First step is the trigger; later steps are actions.
- Use only real Plumber appKey/key pairs the user can access.
- Do not invent apps or action keys.
- Put the block at the end of your reply. Do not wrap it in a markdown code fence.`

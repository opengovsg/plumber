import ExecutionStep from './execution-step'
import Flow from './flow'
import TableMetadata from './table-metadata'

/**
 * Want to create a new resolver or modify an existing resolver?
 * 1. Add/Change your resolver in graphql.schema.
 * 2. Run `npm run gqlc` to trigger codegen.
 * 3. Start implementing! You can reference the other resolver implementations
 *    to see how to type your resolver function.
 *
 * If your resolver returns a new model, you'll also need to update
 * schema.gql-to-typescript.ts.
 */

export default { ExecutionStep, TableMetadata, Flow }

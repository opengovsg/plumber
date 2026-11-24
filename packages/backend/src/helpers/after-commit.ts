import type { Transaction } from 'objection'

/**
 * Runs `fn` once the transaction commits, and never if it rolls back. Without a transaction it runs at once.
 *
 * IMPORTANT: in a nested transaction this waits for its savepoint, not the outer commit.
 */
export function runAfterCommit(
  trx: Transaction | undefined,
  fn: () => void,
): void {
  if (!trx) {
    fn()
    return
  }
  // The rollback error already reaches the code that ran the transaction.
  trx.executionPromise.then(fn, (): void => {})
}

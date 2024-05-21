import type { QueuePro, WorkerPro } from '@taskforcesh/bullmq-pro'

export async function flushQueue(
  queue: QueuePro,
  worker: WorkerPro,
): Promise<void> {
  await queue.pause()
  await worker.pause()

  await queue.obliterate()

  await queue.resume()
  worker.resume()
}

// Vitest does not manage global context for us in our integration tests.
// So we save the original worker state and restore it later on for other
// integration tests.
export interface WorkerState {
  listeners: Array<
    [
      ReturnType<WorkerPro['eventNames']>[number],
      ReturnType<WorkerPro['listeners']>,
    ]
  >
}

export async function backupWorker(worker: WorkerPro): Promise<WorkerState> {
  const listeners: WorkerState['listeners'] = []
  for (const eventName of worker.eventNames()) {
    listeners.push([eventName, worker.listeners(eventName)])
  }

  return {
    listeners,
  }
}

export async function restoreWorker(
  worker: WorkerPro,
  originalWorkerState: WorkerState,
): Promise<void> {
  worker.removeAllListeners()
  for (const [eventName, eventListeners] of originalWorkerState.listeners) {
    for (const listener of eventListeners) {
      worker.addListener(
        eventName,
        listener as Parameters<typeof worker.addListener>[1],
      )
    }
  }
}
